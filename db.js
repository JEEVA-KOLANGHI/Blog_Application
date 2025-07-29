import mysql from "mysql2";

const connection=mysql.createConnection({
    host:'localhost',
    user:'root',
    password:'JEEVA@kolanghi57',
    database:'blog_app'
});

connection.connect((err)=>{
    if(err){
        console.error("Error connecting to the database:", err);
    }
    else{
        console.log("Connected to the database successfully!");
    }
})

export default connection;