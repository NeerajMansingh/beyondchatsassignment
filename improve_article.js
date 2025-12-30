import express from 'express'
import * as cheerio from 'cheerio';
import axios from 'axios';
import dotenv from 'dotenv'

dotenv.config({ path: '.env' })


const app = express()
const port = 4000

app.get('/improve', async(req, res) => {
  const titles_list=[];

  for(let i=1;i<=5;i++)
  {
    const temp=await axios.get(`http://localhost:3000/articles/${i}`);
    const temp_title=temp.data.title;
    titles_list.push(temp_title);
  }

  
})

app.listen(port, () => {
  console.log(`Example app 2 listening on port ${port}`)
})
