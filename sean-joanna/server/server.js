'use strict'

// Application dependencies
const express = require('express');
const cors = require('cors');
const pg = require('pg');
const superagent = require('superagent');

// Application Setup
const app = express();
const PORT = process.env.PORT;
const CLIENT_URL = process.env.CLIENT_URL;
const TOKEN = process.env.TOKEN;

// COMMENT: Explain the following line of code. What is the API_KEY? Where did it come from?
//The API_KEY is set from a process to grab the GOOGLE_API_KEY from the enviroment on the local machine settings. 
const API_KEY = process.env.GOOGLE_API_KEY;

// Database Setup
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('error', err => console.error(err));

// Application Middleware
app.use(cors());

// API Endpoints
app.get('/api/v1/admin', (req, res) => res.send(TOKEN === parseInt(req.query.token)))

app.get('/api/v1/books/find', (req, res) => {
  let url = 'https://www.googleapis.com/books/v1/volumes';

  // COMMENT: Explain the following four lines of code. How is the query built out? What information will be used to create the query? 
  // This query is built out by the search fields initially the query is empty. The search inputs in the search form have a condition of either an input or and empty input. These lines of code add to the query only if the input exists from the search form.
  let query = ''
  if(req.query.title) query += `+intitle:${req.query.title}`;
  if(req.query.author) query += `+inauthor:${req.query.author}`;
  if(req.query.isbn) query += `+isbn:${req.query.isbn}`;

  // COMMENT: What is superagent? How is it being used here? What other libraries are available that could be used for the same purpose?
  //Superagent acts as the middle man (middleware) between the client and the database so that information such as a token can be hidden from the browser. Here the superagent is being to used to request a query for the API_KEY. This could also be done with React.js or Saga.js.
  superagent.get(url)
    .query({'q': query})
    .query({'key': API_KEY})
    .then(response => response.body.items.map((book, idx) => {

      // COMMENT: The line below is an example of destructuring. Explain destructuring in your own words. 
      // This is extracting the individual properties of the book object and assigning them to a new variables defined in the object defined by the let.
      let { title, authors, industryIdentifiers, imageLinks, description } = book.volumeInfo;

      // COMMENT: What is the purpose of the following placeholder image?
      //To assign a default book image in the condition that one does not exist.
      let placeholderImage = 'http://www.newyorkpaddy.com/images/covers/NoCoverAvailable.jpg';

      // COMMENT: Explain how ternary operators are being used below.
      //The ternary operators below are used to identify if the variables unpacked from the book object exist or not. If the variables exist then they are passed into the new object, if not the "No 'something' available" or placeholder variable is passed into the object.
      return {
        title: title ? title : 'No title available',
        author: authors ? authors[0] : 'No authors available',
        isbn: industryIdentifiers ? `ISBN_13 ${industryIdentifiers[0].identifier}` : 'No ISBN available',
        image_url: imageLinks ? imageLinks.smallThumbnail : placeholderImage,
        description: description ? description : 'No description available',
        book_id: industryIdentifiers ? `${industryIdentifiers[0].identifier}` : '',
      }
    }))
    .then(arr => res.send(arr))
    .catch(console.error)
})

// COMMENT: How does this route differ from the route above? What does ':isbn' refer to in the code below?
//This route is different because it does not create a query which may have many properties, it creates a query from just isbn which gives a single result rather than a result that may return many book objects based on the inputs from the search field. The previous api request may have many properties however this api request only has one property, isbn, and thus will return only a single book object. 
app.get('/api/v1/books/find/:isbn', (req, res) => {
  let url = 'https://www.googleapis.com/books/v1/volumes';
  superagent.get(url)
    .query({ 'q': `+isbn:${req.params.isbn}`})
    .query({ 'key': API_KEY })
    .then(response => response.body.items.map((book, idx) => {
      let { title, authors, industryIdentifiers, imageLinks, description } = book.volumeInfo;
      let placeholderImage = 'http://www.newyorkpaddy.com/images/covers/NoCoverAvailable.jpg';

      return {
        title: title ? title : 'No title available',
        author: authors ? authors[0] : 'No authors available',
        isbn: industryIdentifiers ? `ISBN_13 ${industryIdentifiers[0].identifier}` : 'No ISBN available',
        image_url: imageLinks ? imageLinks.smallThumbnail : placeholderImage,
        description: description ? description : 'No description available',
      }
    }))
    .then(book => res.send(book[0]))
    .catch(console.error)
})

app.get('/api/v1/books', (req, res) => {
  client.query(`SELECT book_id, title, author, image_url, isbn FROM books;`)
    .then(results => res.send(results.rows))
    .catch(console.error);
});

app.get('/api/v1/books/:id', (req, res) => {
  client.query(`SELECT * FROM books WHERE book_id=${req.params.id}`)
    .then(results => res.send(results.rows))
    .catch(console.error);
});

app.post('/api/v1/books', express.urlencoded(), (req, res) => {
  let {title, author, isbn, image_url, description} = req.body;
  client.query(`
    INSERT INTO books(title, author, isbn, image_url, description) VALUES($1, $2, $3, $4, $5)`,
    [title, author, isbn, image_url, description]
  )
  .then(results => res.sendStatus(201))
  .catch(console.error);
});

app.put('/api/v1/books/:id', express.urlencoded(), (req, res) => {
  let {title, author, isbn, image_url, description} = req.body;
  client.query(`
    UPDATE books
    SET title=$1, author=$2, isbn=$3, image_url=$4, description=$5
    WHERE book_id=$6`,
    [title, author, isbn, image_url, description, req.params.id]
  )
  .then(() => res.sendStatus(204))
  .catch(console.error)
})

app.delete('/api/v1/books/:id', (req, res) => {
  client.query('DELETE FROM books WHERE book_id=$1', [req.params.id])
  .then(() => res.sendStatus(204))
  .catch(console.error);
});

app.get('*', (req, res) => res.redirect(CLIENT_URL));
app.listen(PORT, () => console.log(`Listening on port: ${PORT}`));