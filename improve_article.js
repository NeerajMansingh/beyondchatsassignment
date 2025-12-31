import express from 'express'
import * as cheerio from 'cheerio';
import axios from 'axios';
import dotenv from 'dotenv'

dotenv.config({ path: '.env' })


const app = express()
const port = 4000

const SEARCH_ENGINE_ID = process.env.SEARCH_ENGINE_ID; 

const AXIOS_OPTIONS = {   //To disguise web scrapper as browser
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  }
};

app.get('/improve', async(req, res) => {
  const beyondchats_articles=[];   //[{id,title},...]  array of objects 
  const competitiors_articles=[];

//   console.log("Debug Keys:");
// console.log("API KEY:", process.env.GOOGLE_API_KEY ? "Loaded" : "MISSING!");
// console.log("CX ID:", process.env.SEARCH_ENGINE_ID ? "Loaded" : "MISSING!");

  for(let i=1;i<=5;i++)
  {
    try { 
        const temp=await axios.get(`http://localhost:3000/articles/${i}`);
        const temp_title=temp.data.title;
        const temp_id=temp.data.id;
        beyondchats_articles.push({temp_id,temp_title});
    } catch(e) { console.log("Skipped ID " + i); } 
  }

  for(let i in beyondchats_articles) 
  {
    const temp_data={};
    const title_id=beyondchats_articles[i].temp_id; //must match the key pushed above: temp_id
    const title_query=beyondchats_articles[i].temp_title; //must match key: temp_title
    
    //use the google URL
    const google_url = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(title_query)}`;
    
    try { 
        const google_data= await axios.get(google_url);
        const google_aritcles_items=google_data.data.items || []; //safety check
        temp_data.id=title_id;
        temp_data.original_title=title_query; 
        temp_data.competitors = []; //array to store the 2 results

        if(google_aritcles_items.length==0)
        {
        console.log("No google search found for this article");
        continue;
        }

        let counter=0; 

        for(let j in google_aritcles_items)
        {
        //check if link contains 'beyondchats', don't compare link to title
        if(google_aritcles_items[j].link.includes('beyondchats.com')) continue; 
        if(counter == 2) break;

        // push the data needed (Link, Title, Snippet)
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
  
  res.json(competitiors_articles); //to see the output in browser
})

app.listen(port, () => {
  console.log(`Example app 2 listening on port ${port}`)
})