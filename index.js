const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 3000;

const admin = require("firebase-admin");
// const serviceAccount = require('bd-career-code-2025-firebase-admin-key.json');
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8');
const serviceAccount = JSON.parse(decoded);



// middleware
app.use(
  cors({
    origin: ["http://localhost:5173"], // client frontend url
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const logger = (req, res, next) => {
  next();
};

// const verifyToken = (req, res, next)=>{
//   // console.log('cookie in the middleware', req.cookies);
//   const token = req?.cookies?.token;

//    console.log('cookie in the middleware', token);

//    if(!token){
//     return res.status(401).send({message: 'unauthorized access'})
//    }

//    //Verify
//    jwt.verify(token, process.env.JWT_SECRET,  (err, decoded)=>{
//       if(err){
//         return res.status(401).send({message: 'unauthorized access'})
//       }
//       // console.log(decoded) //{ email: 'apple@gmail.com', iat: 1766861761, exp: 1766865361 }
//       req.decoded = decoded;   // set decoded to req object
//       //
//       next();
//    })

//   // //
//   // next(); //turn up the next
// }

app.get("/", (req, res) => {
  res.send("Bd career code server is running");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fvmax46.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});


// const admin = require("firebase-admin");
// const serviceAccount = require("./career-firebase-admin-key.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

//verify firebase token Middleware
const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req?.headers?.authorization;  // access from the client side

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  try {
    // const userInfo = await admin.auth().verifyIdToken(token);
    // req.tokenEmail = userInfo.email;

    const decoded = await admin.auth().verifyIdToken(token);
    // console.log('decoded token:', decoded);
    req.decoded = decoded;

    next();
  } catch (error) {
    return res.status(401).send({ message: "unauthorized access" });
  }
};

//verifyEmailToken
const verifyTokenEmail = (req, res, next) => {
  if (req.query.email !== req.decoded.email) {
    return res.status(403).send({ message: "forbidden access" });
  }

  next();
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const jobsCollection = client.db("careerCodeDB25").collection("jobs");
    const applicationCollection = client
      .db("careerCodeDB25")
      .collection("applications");

    // jwt token related Api
    // app.post("/jwt", async (req, res) => {
    //   const userData = req.body;
    //   const token = jwt.sign(userData, process.env.JWT_SECRET, {
    //     expiresIn: "1h",
    //   });

    //   //set token in cookie
    //   res.cookie("token", token, {
    //     httpOnly: true,
    //     secure: false,
    //   });

    //   res.send({ success: true });
    // });

    // jobs related api
    app.post("/jobs", async (req, res) => {
      const newJob = req.body;
      const result = await jobsCollection.insertOne(newJob);
      res.send(result);
    });

    app.get("/jobs/applications", verifyFirebaseToken, verifyTokenEmail,  async (req, res) => {
      const email = req.query.email;

      // if(email !== req.decoded.email){
      //     return res.status(403).send({ message: "forbidden access" }); OR verifyTokenEmail
      //   }

      const query = { hr_email: email };
      const jobs = await jobsCollection.find(query).toArray();

      for (const job of jobs) {
        const applicationQuery = { jobId: job._id.toString() };
        const application_count = await applicationCollection.countDocuments(
          applicationQuery
        );
        job.application_count = application_count;
      }

      res.send(jobs);
    });

    app.get("/jobs", async (req, res) => {
      const email = req.query.email;

      const query = {};

      if (email) {
        query.hr_email = email;
      }

      const cursor = jobsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // could be Done
    app.get("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.findOne(query);
      res.send(result);
    });

    // Application related Apis Firebase Token
    app.get("/applications", verifyFirebaseToken, verifyTokenEmail, async (req, res) => {
        const email = req.query.email;

        // console.log('req headers', req.headers.authorization) // we will do it a middleware

        // if(email !== req.decoded.email){
        //   return res.status(403).send({ message: "forbidden access" }); OR verifyTokenEmail
        // }

        const query = {
          applicant: email,
        };
        const result = await applicationCollection.find(query).toArray();

        //bad way to aggregate data
        for (const application of result) {
          const jobId = application.jobId;
          const jobQuery = { _id: new ObjectId(jobId) };
          const job = await jobsCollection.findOne(jobQuery);
          application.company = job.company;
          application.title = job.title;
          application.company_logo = job.company_logo;
        }

        res.send(result);
      }
    );

    // app.get('/applications', logger, verifyToken,  async(req, res)=>{
    //   const email = req.query.email;

    //   // console.log('inside application api', req.cookies)

    //   // decoded er all everything comes here
    //   if(email !==req?.decoded?.email){
    //       return res.status(403).send({message: 'forbidden access'})
    //   }

    //   const query ={
    //     applicant: email
    //   }
    //   const result = await applicationCollection.find(query).toArray();

    //   //bad way to aggregate data
    //   for(const application of result){
    //     const jobId = application.jobId;
    //     const jobQuery ={ _id : new ObjectId(jobId)};
    //     const job = await jobsCollection.findOne(jobQuery);
    //     application.company = job.company;
    //     application.title = job.title
    //     application.company_logo = job.company_logo
    //   }

    //   res.send(result)
    // });

    // jobId diye applications collection er koyta job application hoyese
    app.get("/applications/job/:job_id", async (req, res) => {
      const job_id = req.params.job_id;
      const query = { jobId: job_id };
      const result = await applicationCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/applications", async (req, res) => {
      const application = req.body;
      const result = await applicationCollection.insertOne(application);
      res.send(result);
    });

    // updated status of applications jobs
    app.patch("/applications/:id", async (req, res) => {
      const id = req.params.id;
      const updated = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: updated.status,
        },
      };
      const result = await applicationCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Bd career code server is running on port ${port}`);
});
