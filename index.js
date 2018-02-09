const express = require('express')
const  dotenv = require('dotenv')
dotenv.config()

const validUrl = require('valid-url')

const  app = express()

const  mongodb = require('mongodb');
let uri = process.env.MONGOLAB_URI_FROM_LOCAL || process.env.DB_URL_FROM_HEROKU

//Inserts a new short URL into the Database Collection
async function insertNewShortURL(collection,url,hosturl){
let randomURL 
 do{
   randomURL = hosturl + "/" + Math.floor(Math.random()*10000)
   sameShortURLFound = await collection.find({short_url: randomURL}).count()
   console.log(sameShortURLFound)
 }while(sameShortURLFound > 0)
 let newEntry = ({original_url: url, short_url: randomURL})
 collection.insert(newEntry)
 return newEntry
}

//Connects to DB and returns the database client
async function connectToDB(){
let client

  try{
    client = await mongodb.MongoClient.connect(uri)

    console.log("In the database now.")
   let db = client.db('shorturls')
   let storedurls = db.collection('storedurls')

    return {theClient: client,
            database: db,
            collection: storedurls}
  }catch(err){console.log(err)}
  
}

//Closes the connection to the database client
async function closeDBConnection(client){
   try{await client.close()
       console.log('Connection to MongoClient closed.')
   }catch(err){console.log('Error closing connection',err)}
 
}


app.get('/new/*', async function (req, res){
  if(validUrl.isUri(req.params[0])){
 
  let dbConnection = await connectToDB()
  
  let  cursor = dbConnection.collection.find({original_url: req.params[0],short_url:{$in:[new RegExp(req.get('Host'),"g")]}})
  let websiteFound = await cursor.count()
  
  //coercing now the count of websitesFound to a boolean
  if(websiteFound){    
     let websiteItem = await cursor.next()
     console.log("Here is the website url: ", JSON.stringify(websiteItem,["original_url","short_url"])) 
     res.end("This website exists in the database. "+ JSON.stringify(websiteItem,["original_url","short_url"]))  
  }
  else{
     console.log("We did not find a website in the database.")
     let newEntry = await insertNewShortURL(dbConnection.collection,req.params[0],req.get('Host'))
     res.end("No such website found. A new short URL was inserted: "+ JSON.stringify(newEntry,["original_url","short_url"]))
  }

closeDBConnection(dbConnection.theClient)
}
else
 res.status(400).send({error: "Wrong url format. Make sure you have a valid uri."})
})

app.get('/*',async function (req,res){
  let dbConnection = await connectToDB()
  let cursor = dbConnection.collection.find({short_url: req.get('Host')+req.url})
  let websiteFound = await cursor.count()

  if(websiteFound){
   let websiteURL = await cursor.next()
   console.log(websiteURL.original_url)   
//   res.end("Redirecting!")
    
    res.redirect(websiteURL.original_url)

  }
  else{
    res.status(400).send({error: "The url '" + req.url.substring(1) + "' is not in the database."})
   //error message
  }

closeDBConnection(dbConnection.theClient)
           })

app.listen(process.env.PORT || 3000)
