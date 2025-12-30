import express from 'express'
import * as cheerio from 'cheerio';
import axios from 'axios';

const app = express()
const port = 3000

let list_links=[];


app.get('/articles', async(req, res) => {
  //let temp= await get_website_content();
  const response = await axios.get('https://beyondchats.com/blogs/', { timeout: 10000 });
  const $ = cheerio.load(response.data);
  const pageLinks = $('a[href*="page/"]');
  const lastPageLink = pageLinks.filter((i, el) => !$(el).text().includes('Next')).last();
  let total_pages = parseInt(lastPageLink.text());

  let list_links = [];

  for(let i = total_pages; i >= 1; i--) {
    const response_loop = await axios.get(`https://beyondchats.com/blogs/page/${i}`, { timeout: 10000 });
    const $_loop = cheerio.load(response_loop.data);
    const articleLinks = $_loop('#main article h2 a').map((i, el) => $_loop(el).attr('href')).get().reverse();
    list_links.push(...articleLinks);
    if(list_links.length >= 5) {
      break;
    }
  }

  list_links = list_links.slice(0, 5);

  let articles = [];
  for (let i = 0; i < list_links.length; i++) {
    const response = await axios.get(list_links[i], { timeout: 10000 });
    const $ = cheerio.load(response.data);
    const title = $('h1').first().text().trim();
    const author = $('a[href*="author"]').text().trim();
    const body = $('.post-content').text().trim();
    articles.push({ id: i + 1, title, author, body });
  }

  res.send(articles);
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

