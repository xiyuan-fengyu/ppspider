import {MongoClient} from "mongodb";

const url = 'mongodb://192.168.1.150:27017/ppspider';
MongoClient.connect(url, {useNewUrlParser: true}, (err, client) => {
    const defaultDb = client.db("ppspider");
    defaultDb.collections().then(res => {
        const collectionNames = res.map(item => item.collectionName);
        console.log(collectionNames);
    })
});

/*
{
    "_id" : 2,
    "name" : "Test",
    "code" : true
}
 */