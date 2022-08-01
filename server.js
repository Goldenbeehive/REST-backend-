require('dotenv').config();
const newsApiKey = ' ';
const express = require('express');
const app = express();
const mysql = require('mysql');
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt');
const host = '127.0.0.1' // currently localhost 
let articles = [
    'Bill Russell, 11-time NBA champion and Boston Celtics legend, dies at 88 - CBS Sports',
    'Five stabbed at Apple River, Minnesota teen dead, Wisconsin sheriff says - Star Tribune',
    'Doctor: Biden tests positive for COVID for 2nd day in a row - The Associated Press',
    "England wins its first ever major women's championship in 2-1 Euro 2022 win over Germany - CNN",
    'Someone in Illinois won the $1.337 billion Mega Millions jackpot—the third-largest lottery prize in U.S. history - CNBC',
    'Kentucky floods kill at least 26, number to keep rising, governor says - Reuters.com',
    'Ne-Yo’s wife, Crystal Renay, accuses him of cheating: ‘8 years of lies and deception’ - Page Six',
    'Nichelle Nichols, Uhura in ‘Star Trek,’ Dies at 89 - Variety',
    'Ukraine live updates: Drone strikes Russian forces in Crimea - USA TODAY',
    'A TikTok Music app could challenge Spotify and Apple - The Verge',
    'Banana Boat Recalls Hair and Scalp Sunscreen Over Low Levels of Carcinogen - The New York Times',
    'Mariners Place Julio Rodriguez, Dylan Moore On 10-Day IL; Ty France To Undergo MRI - MLB Trade Rumors',
    'Hasim Rahman Jr. reacts to Jake Paul fight cancellation: ‘How’s the fight off on me when they cancelled the e… - MMA Fighting',
    'Sylvester Stallone is pissed about MGM making a Rocky spin-off about the Drago family - The A.V. Club',
    'UN peacekeepers open fire in DR Congo, causing several casualties - Al Jazeera English',
    "The Pixel 6A is getting an immediate update to make sure it's moddable - The Verge",
    "Manchin touts inflation reduction bill, says 'I'm not getting involved' in upcoming elections - CNBC",
    'California and Montana wildfires explode in size, forcing evacuation orders - The Guardian',
    'War With Russia Enters New Phase as Ukraine Readies Southern Counterblow - The Wall Street Journal',
    'Box Office: ‘DC League of Super-Pets’ Opens to Lackluster $23M - Hollywood Reporter'
  ] // Gotten using api
  let titles = articles.map((elem ,index) =>{return index +' '+ elem} ).join('<br/>'); 
// Structure of App:
// Endpoints:
// reg -> register user for the first time
// login -> login existing user 
let pool = mysql.createPool({
    host : host,
    user : ' ',
    password: ' ',
    database : ' ' //2 tables: users(username , password, refresh) comments(id,username,comment)
})
 
app.use(express.json()); 
// Register user endpoint.
app.post('/reg', async (req,res)=>{
    // check if username and password sent and in the correctly named field
    if(req.body.username === undefined || req.body.password === undefined){
        return res.status(400).send('registering requests should have username and password in json format');
    }
    let user = { username: req.body.username, password: req.body.password } // for ease of access
    //Check if username already exists in database
    let nameNotExist = false;
     await new Promise((resolve,reject)=>{
        pool.getConnection(function(err, connection) {
              // not input sanitised brob3 gneh.
             // needs a sanitization library but will do for a mock project. 
            connection.query(`select * from users where username = '${user.username}'`,(err,results)=>{
                if(err){reject(err);};
                if (results.length === 0){
                    nameNotExist = true;
                }
                resolve('OK')
                
            });  
        });
       
     })
   
    if(nameNotExist){
        user.password = await bcrypt.hash(req.body.password, 10);
        await new Promise((resolve,reject)=>{
            pool.getConnection(function(err, connection) { 
                connection.query(`INSERT INTO users (username,password) VALUES ('${user.username}', '${user.password}');`,(err,results)=>{
                    if(err){ reject(err);};
                    resolve('OK')
                     
                });  
            });
           
         })
         return res.status(200).send('Register success!');
    }else{
        return res.status(401).send('That username already exists.')
    }
})
// login user endpoint
app.post('/login',async (req,res)=>{
    const user = { username: req.body.username , password: req.body.password }
    let passwordCorrect = false;
    await new Promise((resolve,reject)=>{
        pool.getConnection(function(err, connection) { 
            connection.query(`select password from users where username = '${user.username}';`,async (err,results)=>{
                if(results.length === 0){
                    return res.status(401).send(`That user doesn't exist use the /reg endpoint to register.`)
                } 
                results=JSON.parse(JSON.stringify(results))
                passwordCorrect = await bcrypt.compare(user.password, results[0].password);
                resolve('OK')
            });  
        });
      
       
     })
     if(passwordCorrect){
        const accessToken = jwt.sign({name: user.username}, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '30m' });
        const refreshToken = jwt.sign({name: user.username}, process.env.REFRESH_TOKEN_SECRET);
        await new Promise((resolve,reject)=>{
            pool.getConnection(function(err, connection) { 
                connection.query(`UPDATE users SET refresh = '${refreshToken}'  WHERE username = '${user.username}';`,async (err,results)=>{
                    resolve('OK')
                });  
            });            
         })
         return res.status(200).send(`Login successful!\n\naccesstoken = ${accessToken}\n\nrefreshtoken = ${refreshToken}`);
     }else{
        return res.status(401).send(`Password Incorrect`);
     }
  
     
  })
  
 
app.delete('/logout', async (req, res) => {
    if(req.body.username === undefined ){
        return res.status(400).send('logout requests should have username in json format');
    }
    await new Promise((resolve,reject)=>{
        pool.getConnection(function(err, connection) { 
            connection.query(`UPDATE users SET refresh = null  WHERE username = '${req.body.username}';`,async (err,results)=>{
                resolve('OK')
            });  
        });            
     })
    res.status(204).send('Logout successfull!');
  })
  
  app.post('/token', async (req, res) => {
    const refreshToken = req.body.token;
    if (refreshToken == null) return res.sendStatus(401)
    let includes = false;
    const username = jwt.decode(refreshToken).name
    await new Promise((resolve,reject)=>{
        pool.getConnection(function(err, connection) { 
            connection.query(`SELECT refresh from users where username = '${username}';`,async (err,results)=>{
                results=JSON.parse(JSON.stringify(results))
                if (results[0].refresh === null){
                    return res.status(401).send(`Please login first`);
                }else{
                    if(results[0].refresh === refreshToken){
                    includes = true;
                    }
                }
                resolve('OK')
            });  
        });            
     })
     if(!includes){return res.sendStatus(403)};
     jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
        if (err) return res.sendStatus(403)
        const accessToken = jwt.sign({name: username}, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '30m' });
        res.json({ accessToken: accessToken })
      })
  });

app.get('/user/posts',(req,res)=>{
    const token = req.body.token
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        if (err) return res.status(403).send('Please Refresh Token');
        return res.status(200).send(`Welcome ${user.name}!\n` +titles);
      })



});
app.post('/user/comment/:id',async(req,res)=>{
    const id = req.params.id;
    if (id>articles.length-1){
        return res.sendStatus(401);
    } 
    const token = req.body.token;
    let comment = {name:'', comment: req.body.comment}
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        if (err) return res.status(403).send('Please Refresh Token');
        comment.name = user.name;
      })
      await new Promise((resolve,reject)=>{
        pool.getConnection(function(err, connection) { 
            connection.query(`insert into comments(id,username,comment) values('${id}','${comment.name}','${comment.comment}');`,async (err,results)=>{
                resolve('OK')
            });  
        });            
     })
     return res.status(200).send('comment sent!');
})
app.get('/user/view/:id',async(req,res)=>{
    const id = req.params.id;
    if (id>articles.length-1){
        return res.sendStatus(401);
    }  
    const token = req.body.token;
    
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        if (err) return res.status(403).send('Please Refresh Token');
          
      }) 
      await new Promise((resolve,reject)=>{
        pool.getConnection(function(err, connection) { 
            connection.query(`select * from comments where id= ${id}`,async (err,results)=>{
                results=JSON.parse(JSON.stringify(results))
                const comments = [];
                results.forEach(elem => comments.push(elem.username+": " +elem.comment ));
                 return res.status(200).send(comments.join('<br/>'))
                resolve('OK')
            });  
        });            
     })
     return res.status(200) 
})
app.listen(3000); 