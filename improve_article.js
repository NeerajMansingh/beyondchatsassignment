import express from 'express'
import * as cheerio from 'cheerio';  //using cheerio for web scrapping
import axios from 'axios';
import dotenv from 'dotenv'
import Groq from "groq-sdk";
import cors from 'cors';


const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
dotenv.config({ path: '.env' })
const app = express()
const port = 4000

app.use(cors()); 
app.use(express.json());


const SEARCH_ENGINE_ID = process.env.SEARCH_ENGINE_ID; 

// Initialized Groq
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const AXIOS_OPTIONS = {   
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  }
};

app.get('/improve', async(req, res) => {
  const beyondchats_articles=[];   
  const competitiors_articles=[];

  //Fetch all articles first to handle ID gaps safely
  const allArticlesResponse = await axios.get(`http://localhost:3000/articles`);
  const allArticles = allArticlesResponse.data;

  for(let articleData of allArticles)
  {
    try { 
        // You already have 'articleData', just use it directly!
        const temp_title = articleData.title;
        const temp_id = articleData.id;
        
        // Read from 'original_body' if available, fallback to 'body'
        const temp_body = articleData.original_body || articleData.body;
        
        beyondchats_articles.push({ 
            temp_id, 
            temp_title, 
            temp_body 
        });
    } catch(e) { console.log("Skipped ID"); } 
  }

  for(let i in beyondchats_articles) 
  {
    const temp_data={};
    const title_id=beyondchats_articles[i].temp_id; 
    const title_query=beyondchats_articles[i].temp_title; 
    
    //use the google URL
    const google_url = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(title_query)}`;
    
    await delay(1500)

    try { 
        const google_data= await axios.get(google_url);
        const google_aritcles_items=google_data.data.items || []; 
        temp_data.id=title_id;
        temp_data.original_title=title_query;
        temp_data.original_body = beyondchats_articles[i].temp_body;
        
        temp_data.competitors = []; 

        if(google_aritcles_items.length==0)
        {
        console.log("No google search found for this article");
        continue;
        }

        let counter=0; 

        for(let j in google_aritcles_items)
        {
        if(google_aritcles_items[j].link.includes('beyondchats.com')) continue; 
        if(counter == 2) break;

        temp_data.competitors.push({ 
            link: google_aritcles_items[j].link, 
            title: google_aritcles_items[j].title,
            snippet: google_aritcles_items[j].snippet 
        }); 

        counter++; 
        }

        competitiors_articles.push(temp_data);
    } catch(e) { console.log(e.message); } 
  }


  for(let i in competitiors_articles)
  {

    try{
    const response1= await axios.get(competitiors_articles[i].competitors[0].link,AXIOS_OPTIONS);
    const $ = cheerio.load(response1.data);
    $('script, style, nav, footer, header, iframe').remove();
    const cleanText = $('body').text().replace(/\s\s+/g, ' ').trim();

    competitiors_articles[i].competitors[0].llmtext=cleanText;
    }
    catch(e){
      console.log("unable to scrape");
    }

  }

  for(let i in competitiors_articles)
  {
    try{
    const response2= await axios.get(competitiors_articles[i].competitors[1].link,AXIOS_OPTIONS);
    const $ = cheerio.load(response2.data);
    $('script, style, nav, footer, header, iframe').remove();
    const cleanText = $('body').text().replace(/\s\s+/g, ' ').trim();

    competitiors_articles[i].competitors[1].llmtext=cleanText;
    }
    catch(e){
      console.log("unable to scrape");
    }
  }

  // AI SECTION (GROQ)
  for(let i in competitiors_articles) 
  { 
    const article = competitiors_articles[i]; 
    console.log(`\n=== Processing Article ID: ${article.id} ===`); 

    let success = false;
    let attempts = 0;

    while(!success && attempts < 3) {
        attempts++;
        try { 
           const comp1_text = article.competitors[0]?.llmtext || ""; 
           const comp2_text = article.competitors[1]?.llmtext || ""; 
           
           console.log(`  -> Attempt ${attempts}: Sending to Groq (Llama-3.3)...`);

           //prompt
           const prompt = `Rewrite the following article to be detailed, comprehensive, and well-structured using Markdown.
           
           Original Title: ${article.original_title}
           Original Content: ${article.original_body}
           
           Competitor 1 Content: ${comp1_text.substring(0, 6000)}
           Competitor 2 Content: ${comp2_text.substring(0, 6000)}
           
           INSTRUCTIONS:
           1. Use proper Markdown formatting (# Headings, **bold**, bullet points).
           2. Make the content significantly more detailed than the original.
           3. Add a "References" section at the very bottom.
           4. Return ONLY the new article text.`; 

           const completion = await groq.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "llama-3.3-70b-versatile", 
           });

           const new_content = completion.choices[0]?.message?.content || ""; 
           
           //Send 'ai_body'
           await axios.put(`http://localhost:3000/articles/${article.id}`, { 
               ai_body: new_content 
           }); 
           
           console.log("Database Updated (AI Version Saved)."); 
           success = true; 

           console.log("Cooldown: Waiting 25 seconds...");
           await delay(25000);

        } catch(e) { 
           console.log(`Error on Attempt ${attempts}: ` + e.message); 
           
           if(e.message.includes("429")) {
              console.log("Rate Limit! Groq allows ~30 requests/min. Waiting 60s...");
              await delay(60000); 
           } else {
              console.log("Non-recoverable error. Skipping.");
              break; 
           }
        } 
    }
  }
  
  res.json(competitiors_articles); 
})

app.listen(port, () => {
  console.log(`AI Worker listening on port ${port}`)
})