import express from 'express';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import ffmpeg from 'fluent-ffmpeg';
import * as tf from '@tensorflow/tfjs';
import use from '@tensorflow-models/universal-sentence-encoder';
import cosineSimilarity from 'compute-cosine-similarity';

import { Video, Tag } from './sequelize.mjs';
import indexVideos from './indexVideos.mjs';
import generateThumbnails from './generateThumbnails.mjs';
import getTranscriptions from './getTranscriptions.mjs';
import generateTags from './generateTags.mjs';

const app = express();
const port = 3000;

const audioDir = join(process.cwd(), 'audio');
if (!existsSync(audioDir)) {
  mkdirSync(audioDir);
}

await indexVideos();
generateThumbnails();
await getTranscriptions();
generateTags();

app.use(express.static('public'));
app.use('/thumbs', express.static(join(process.cwd(), 'videos/thumbs')));


app.get('/videos', async (req, res) => {
  const videos = await Video.findAll({
    attributes: ['id', 'slug', 'filename','transcript','thumbnail','tags']
  });
  res.json({videos});
});

app.get('/tags', async (req, res) => {
  try {
    const tags = await Tag.findAll({
      attributes: ['id', 'name']
    });
    res.json({tags});
  } catch (error) {
    console.error('Error fetching tags:', error.message);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});



// let model;

// // Load the Universal Sentence Encoder model
// await use.load().then(loadedModel => {
//     model = loadedModel;
//     console.log('Universal Sentence Encoder loaded');
// });

// // Function to get embeddings
// async function getEmbeddings(tags) {
//     const embeddings = await model.embed(tags);
//     return embeddings.array();
// }

// // Function to compute tag similarity
// async function getSimilarTags(tag, allTags) {
//     const allTagsArray = [tag, ...allTags];
//     const embeddings = await getEmbeddings(allTagsArray);

//     const tagVector = embeddings[0];
//     const similarities = allTags.map((otherTag, index) => {
//         const otherTagVector = embeddings[index + 1];
//         return { tag: otherTag, similarity: cosineSimilarity(tagVector, otherTagVector) };
//     });

//     // Sort tags by similarity in descending order
//     similarities.sort((a, b) => b.similarity - a.similarity);
//     return similarities;
// }

// app.get('/similar-tags', async (req, res) => {
//     const { tag } = req.query;
//     const tags = await Tag.findAll({
//       attributes: ['id', 'name']
//     });
//     const tagsArray = tags.map(tag => tag.name);
//     const similarTags = await getSimilarTags(tag, tagsArray);
//     res.json({similarTags});
// });

app.get('/video/:slug', async (req, res) => {
  const { slug } = req.params;
  const video = await Video.findOne({ where: { slug } });
  if (video) {
    const videoPath = join(process.cwd(), 'videos', video.filename);
    if (existsSync(videoPath)) {
      res.sendFile(videoPath);
    } else {
      res.status(404).send('Video not found');
    }
  } else {
    res.status(404).send('Video not found');
  }
});

app.get('/audio/:slug', async (req, res) => {
  const { slug } = req.params;
  const video = await Video.findOne({ where: { slug } });
  if (video) {
    const videoPath = join(process.cwd(), 'videos', video.filename);
    if (existsSync(videoPath)) {
      res.setHeader('Content-Type', 'audio/mpeg');

      ffmpeg(videoPath)
        .noVideo()
        .audioCodec('libmp3lame')
        .format('mp3')
        .on('start', commandLine => {
          console.log('Spawned ffmpeg with command: ' + commandLine);
        })
        .on('progress', progress => {
          console.log('Processing: ' + progress.percent + '% done');
        })
        .on('error', (err, stdout, stderr) => {
          console.error('Error processing audio:', err.message);
          console.error('ffmpeg stderr:', stderr);
          if (!res.headersSent) {
            res.status(500).send('Error processing audio');
          }
        })
        .on('end', () => {
          console.log(`Streamed audio from ${video.filename}`);
        })
        .pipe(res, { end: true });

    } else {
      res.status(404).send('Audio not found');
    }
  } else {
    res.status(404).send('Audio not found');
  }
});

app.listen(port, () => {
  console.log(`[server] Server is running on http://localhost:${port}`);
});
