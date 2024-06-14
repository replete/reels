import { readFile, unlink } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import ffmpeg from 'fluent-ffmpeg';
import FormData from 'form-data';
import { Video } from './sequelize.mjs';
import { Op } from 'sequelize';

const audioDir = join(process.cwd(), 'audio');

if (!existsSync(audioDir)) {
  mkdirSync(audioDir);
}

const transcribeAudio = async (video, audioPath) => {
  try {
    // Read the audio file as a buffer
    const audioBuffer = await readFile(audioPath);

    // Create a FormData instance and append the buffer as a file
    const formData = new FormData();
    formData.append('file', audioBuffer, {
      contentType: 'audio/wav',
      filename: 'audio.wav'
    });
    formData.append('model', 'base');
    formData.append('language', 'en');

    // Local instance of https://github.com/3choff/FastWhisperAPI
    const response = await fetch('http://localhost:8000/v1/transcriptions', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Authorization': 'Bearer dummy_api_key',
        ...formData.getHeaders()
      },
      body: formData.getBuffer()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! Status: ${response.status}, Response: ${errorText}`);
    }
    const responseText = await response.text();
    const transcript = JSON.parse(responseText).text;
    console.log(`Transcript for ${video.filename}: ${ transcript }`);
    await video.update({ transcript });
  } catch (error) {
    console.error(`Error transcribing ${video.filename}:`, error.message);
  } finally {
    await unlink(audioPath);
  }
};

const generateWavFile = async (video) => {
  const videoPath = join(process.cwd(), 'videos', video.filename);
  const audioPath = join(audioDir, `${video.slug}.wav`);

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec('pcm_s16le')
      .audioFrequency(16000)
      .toFormat('wav')
      .on('error', (err) => reject(err))
      .on('end', () => resolve(audioPath))
      .save(audioPath);
  });
};

const getTranscriptions = async () => {
  try {
    const videos = await Video.findAll({ where: { transcript: {
        [Op.or]: [
            { [Op.eq]: null },
            { [Op.eq]: '' }
        ]
    } } });
    for (const video of videos) {
      const audioPath = await generateWavFile(video);
      await transcribeAudio(video, audioPath);
    }
  } catch (error) {
    console.error('Error processing transcriptions:', error.message);
  }
};

export default getTranscriptions;
