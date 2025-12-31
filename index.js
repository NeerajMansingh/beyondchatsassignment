import express from 'express'
import * as cheerio from 'cheerio';  //using cheerio for web scrapping
import axios from 'axios';
import sqlite3 from 'sqlite3'; //using sql3 for database
import { open } from 'sqlite'; 
import cors from 'cors';

const app = express()
const port = 3000


app.use(cors());
app.use(express.json());

// database setup
let db; 
// create/connect to the database immediately
(async () => {
    db = await open({ filename: 'database.db', driver: sqlite3.Database });
    await db.exec('DROP TABLE IF EXISTS articles');
    await db.exec('CREATE TABLE IF NOT EXISTS articles (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT UNIQUE, author TEXT, body TEXT, ai_body TEXT)');
    console.log("Database Ready");
})();




app.get('/articles', async(req, res) => {
  // check database first
  // if we already have data, return it immediately (don't re-scrape)
  const existingData = await db.all("SELECT * FROM articles");
  if (existingData.length > 0) { 
      return res.send(existingData);
  } 

  
  const response = await axios.get('https://beyondchats.com/blogs/', { timeout: 10000 }); //gets the HTML content of the landing page
  const $ = cheerio.load(response.data);  //creating cheerio object for const response
  const pageLinks = $('a[href*="page/"]');
  const lastPageLink = pageLinks.filter((i, el) => !$(el).text().includes('Next')).last();  //getting number of pages through the html of the page
  let total_pages = parseInt(lastPageLink.text()) || 1; // Added fallback || 1 just in case

  let list_links = []; //stores links of 5 oldest articles

  /*for loop for getting individula link of each article*/
  for(let i = total_pages; i >= 1; i--) {                             
    try {
        const response_loop = await axios.get(`https://beyondchats.com/blogs/page/${i}`, { timeout: 10000 });
        const $_loop = cheerio.load(response_loop.data);
        const articleLinks = $_loop('#main article h2 a').map((i, el) => $_loop(el).attr('href')).get().reverse();
        list_links.push(...articleLinks);
        if(list_links.length >= 5) {   //stop when 5 pages collected
          break;
        }
    } catch(e) { console.log("Skipped page " + i); }
  }

  list_links = list_links.slice(0, 5);   //need only 5 pages


  let articles = []; //array of objects [{id,title,autor,body}]

  /*loop for extracting contents of each pages*/
  for (let i = 0; i < list_links.length; i++) {
    try {
        const response = await axios.get(list_links[i], { timeout: 10000 });
        const $ = cheerio.load(response.data);
        const title = $('h1').first().text().trim();
        const author = $('a[href*="author"]').text().trim();
        const body = $('.post-content p').map((i, el) => $(el).text().trim()).get().join('\n\n');
        articles.push({ id: i + 1, title, author, body });  //for each page, push the contents object into articles
    } catch(e) { console.log("Skipped article " + i); }
  }


  // save the scraped articles so next time we don't have to scrape
  for (let article of articles) { 
      // insert into ai_body as well (NULL initially) 
      await db.run("INSERT OR IGNORE INTO articles (title, author, body, ai_body) VALUES (?, ?, ?, ?)", 
        [article.title, article.author, article.body, null]);
  }

  // Fetch again to ensure IDs are correct from DB
  const finalData = await db.all("SELECT * FROM articles");
  res.send(finalData);
})


// Get single article
app.get('/articles/:id', async (req, res) => {
    const article = await db.get("SELECT * FROM articles WHERE id = ?", req.params.id);
    res.send(article);
});

//update article
app.put('/articles/:id', async (req, res) => {
    // Support updating 'ai_body'
    const { body, ai_body } = req.body;
    
    if (ai_body) {
        // If the request sends 'ai_body', we update that column specifically
        await db.run("UPDATE articles SET ai_body = ? WHERE id = ?", [ai_body, req.params.id]);
        res.send({ message: "AI Content updated successfully" });
    } else {
        // Fallback to original behavior, updating the main body
        await db.run("UPDATE articles SET body = ? WHERE id = ?", [body, req.params.id]);
        res.send({ message: "Updated successfully" });
    }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})


// (create) Add a new article manually
app.post('/articles', async (req, res) => {
    const { title, author, body } = req.body;
    if (!title || !body) {
        return res.status(400).send({ error: "Title and Body are required" });
    }
    
    try {
        // Added ai_body as NULL
        const result = await db.run(
            "INSERT INTO articles (title, author, body, ai_body) VALUES (?, ?, ?, ?)", 
            [title, author || 'Unknown', body, null]
        );
        res.status(201).send({ 
            message: "Article created", 
            id: result.lastID 
        });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// (delete) Remove an article
app.delete('/articles/:id', async (req, res) => {
    try {
        const result = await db.run("DELETE FROM articles WHERE id = ?", req.params.id);
        if (result.changes === 0) {
            return res.status(404).send({ error: "Article not found" });
        }
        res.send({ message: "Article deleted successfully" });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});