const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;
require("dotenv").config();

// middleWare
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const logger = async (req, res, next) => {
  console.log("Log info: ", req.method, req.url, req.host, req.originalUrl);

  next();
};

const verifyToken = async (req, res, next) => {
  const token = req?.cookies?.token;
  console.log("Token from middleWare ", token);

  if (!token) {
    return res.status(401).send({ message: "Unauthorised Acccess" });
  }
  jwt.verify(token, process.env.ACCESS_SECRETE_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorised Access" });
    }
    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kapryhp.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // Data Base
    const dataBase = client.db("carDoctor");
    const servicesCollection = dataBase.collection("services");
    const bookingsCollection = dataBase.collection("bookings");

    //  Auth related API
    app.post("/jwt", logger, async (req, res) => {
      const user = req.body;
      console.log("Token requested user", user);
      // Generating token
      const token = jwt.sign(user, process.env.ACCESS_SECRETE_TOKEN, {
        expiresIn: "1h",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
        })
        .send({ success: true });
    });

    app.post("/logout", logger, async (req, res) => {
      const user = req.body;
      console.log("Logging out user: ", user);

      res.clearCookie("token", { maxAge: 0 }).send({ success: true });
    });

    // services related API
    app.get("/services", logger, async (req, res) => {
      const cursor = servicesCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/services/:id", logger, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const options = {
        projection: {
          service_id: 1,
          price: 1,
          title: 1,
          img: 1,
        },
      };
      const result = await servicesCollection.findOne(query, options);
      res.send(result);
    });

    // bookings
    app.post("/bookings", logger, async (req, res) => {
      const booking = req.body;
      console.log(booking);
      const result = await bookingsCollection.insertOne(booking);
      res.send(result);
    });

    app.get("/bookings", logger, verifyToken, async (req, res) => {
      // console.log("cookies", req.cookies);
      console.log(req.query?.email);
      console.log("Token owner info: ", req?.user);
      if (req.query?.email !== req?.user?.email) {
        return res.status(403).send({ message: "Forbbider Access" });
      }

      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await bookingsCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/bookings/:id", logger, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingsCollection.deleteOne(query);
      res.send(result);
    });

    app.patch("/bookings/:id", logger, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: "confirm",
        },
      };
      const result = await bookingsCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Doctor is Runing");
});

app.listen(port, () => {
  console.log(`The doctor is running on PORT: ${port}`);
});
