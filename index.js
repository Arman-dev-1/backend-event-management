import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

app.use(cors({ 
    origin: "https://event-management-arman.netlify.app", // Allow only your frontend
    methods: "GET,POST,PUT,DELETE",
    credentials: true
}));

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.post('/createevent', upload.single('image'), async (req, res) => {
  const { eventName, description, date, id } = req.body;

  if (!req.file) {
    return res.status(400).send({ message: 'Image is required for the event' });
  }

  try {
    console.log("Uploading to Cloudinary...");

    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: 'image' },
        (error, result) => {
          if (error) {
            console.error("Cloudinary Upload Error:", error);
            return reject(error);
          }
          resolve(result);
        }
      );

      uploadStream.end(req.file.buffer);
    });

    if (!result || !result.secure_url) {
      return res.status(500).send({ message: "Failed to upload image to Cloudinary" });
    }

    console.log("Cloudinary Upload Successful:", result.secure_url);
    console.log("MongoDB URI:", process.env.MONGO_URI);

    // MongoDB connection
    const url = process.env.MONGO_URI;
    if (!url) {
      return res.status(500).send({ message: 'MONGO_URI is missing in .env file' });
    }

    const client = await MongoClient.connect(url);
    const db = client.db('event');

    const newEvent = {
      eventName,
      description,
      date,
      imageUrl: result.secure_url,
      attendees: [],
      id,
    };

    await db.collection('events').insertOne(newEvent);
    client.close();

    res.status(200).send({ message: 'Event created successfully', event: newEvent });

  } catch (err) {
    console.error('Error during event creation:', err);
    res.status(500).send({ message: 'Error creating event', error: err.message });
  }
});


app.get('/sendevents', async (req, res) => {
  const url = process.env.MONGO_URI;
  const dbName = 'event';
  if (!url) {
    return res.status(500).send({ message: 'MONGO_URI is missing in .env file' });
  }
  try {
    const client = await MongoClient.connect(url);
    const db = client.db(dbName);

    const events = await db.collection('events').find({}).toArray();
    client.close();

    res.status(200).send(events);

  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).send({ message: 'Error fetching events', error: err.message });
  }
});

app.post('/signup', async (req, res) => {

  const { username, email, password } = req.body;
  const url = process.env.MONGO_URI;
  const dbName = 'event';

  if (!url) {
    return res.status(500).send({ message: 'MONGO_URI is missing in .env file' });
  }

  try {
    const client = await MongoClient.connect(url);
    const db = client.db(dbName);

    const user = await db.collection('users').findOne({ email });
    console.log(user);

    if (user) {
      client.close();
      return res.status(400).send({ message: 'User already exists' });
    }

    await db.collection('users').insertOne({ username, email, password });
    client.close();

    result = await db.collection('users').findOne({ email });
    id = result._id;

    res.status(200).send({ message: 'User created successfully', id, username });

  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).send({ message: 'Error creating user', error: err.message });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const url = process.env.MONGO_URI;
  const dbName = 'event';

  if (!url) {
    return res.status(500).send({ message: 'MONGO_URI is missing in .env file' });
  }

  try {
    const client = await MongoClient.connect(url);
    const db = client.db(dbName);

    const user = await db.collection('users').findOne({
      email
    });

    if (!user || user.password !== password) {
      client.close();
      return res.status(400).send({ message: 'Invalid email or password' });
    }

    client.close();

    res.status(200).send({ message: 'Login successful', id: user._id, username: user.username });

  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).send({ message: 'Error during login', error: err.message });
  }
});

app.post('/events', async (req, res) => {
  const { eventId } = req.body;
  const url = process.env.MONGO_URI;
  const dbName = 'event';
  console.log(eventId);

  if (!url) {
    return res.status(500).send({ message: 'MONGO_URI is missing in .env file' });
  }

  try {
    const client = await MongoClient.connect(url);
    const db = client.db(dbName);

    const event = await db.collection('events').findOne({ _id: new ObjectId(`${eventId}`) });
    console.log(event);

    if (!event) {
      client.close();
      return res.status(404).send({ message: 'Event not found' });
    }

    client.close();

    res.status(200).send(event);

  } catch (err) {
    console.error('Error fetching event:', err);
    res.status(500).send({ message: 'Error fetching event', error: err.message });
  }
});

app.post('/addattendee', async (req, res) => {
  const { eventId, username, id } = req.body;
  const url = process.env.MONGO_URI;
  const dbName = 'event';
  console.log(eventId, username, id);

  if (!url) {
    return res.status(500).send({ message: 'MONGO_URI is missing in .env file' });
  }

  try {
    const client = await MongoClient.connect(url);
    const db = client.db(dbName);

    const event = await db.collection('events').findOne({ _id: new ObjectId(`${eventId}`) });

    if (!event) {
      client.close();
      return res.status(404).send({ message: 'Event not found' });
    }

    if (event.attendees.some(attendee => attendee.id === id)) {
      client.close();
      return res.status(400).send({ message: 'User is already attended' });
    }

    const attendees = event.attendees ? [...event.attendees, { id, username }] : [{ id, username }];
    await db.collection('events').updateOne({ _id: new ObjectId(`${eventId}`) }, { $set: { attendees } });

    client.close();

    res.status(200).send({ message: 'User added to event successfully' });

  } catch (err) {
    console.error('Error adding user to event:', err);
    res.status(500).send({ message: 'Error adding user to event', error: err.message });
  }
});

app.post('/eventsbyuser', async (req, res) => {
  const { id } = req.body;
  const url = process.env.MONGO_URI;
  const dbName = 'event';
  console.log(id);

  if (!url) {
    return res.status(500).send({ message: 'MONGO_URI is missing in .env file' });
  }

  try {
    const client = await MongoClient.connect(url);
    const db = client.db(dbName);

    const events = await db.collection('events').find({}).toArray();
    const eventbyuser = events.filter(event => event.id === id);
    const filteredEvents = events.filter(event => event.attendees.some(attendee => attendee.id === id));

    client.close();

    res.status(200).send({filteredEvents, eventbyuser});
  } catch (err) {
    console.error('Error fetching events by user:', err);
    res.status(500).send({ message: 'Error fetching events by user', error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


