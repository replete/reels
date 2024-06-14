import express from 'express';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { Video } from './sequelize.mjs';
import indexVideos from './indexVideos.mjs';
import generateThumbnails from './generateThumbnails.mjs';
import getTranscriptions from './getTranscriptions.mjs';

const app = express();
const port = 3000;

const audioDir = join(process.cwd(), 'audio');
if (!existsSync(audioDir)) {
  mkdirSync(audioDir);
}

await indexVideos();
await generateThumbnails();
await getTranscriptions();

app.use(express.static('public'));

app.get('/videos', async (req, res) => {
  const videos = await Video.findAll();
  res.json(videos);
});

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
  console.log(`Server is running on http://localhost:${port}`);
});
