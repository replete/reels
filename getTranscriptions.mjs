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
      throw new Error(`[transcribe] HTTP error! Status: ${response.status}, Response: ${errorText}`);
    }
    const responseText = await response.text();
    let transcript = JSON.parse(responseText).text;
    if (transcript === '') transcript = '-' // no speech detected
    console.log(`[transcribe] Transcript for ${video.filename}: ${ transcript }`);
    await video.update({ transcript });
  } catch (error) {
    console.error(`[transcribe] Error transcribing ${video.filename}:`, error.message);
  } finally {
    await unlink(audioPath);
  }
};

const generateWavFile = async (video) => {
  const videoPath = join(process.cwd(), 'videos', video.filename);
  const audioPath = join(process.cwd(), 'audio', `${video.slug}.wav`);

  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        return reject(new Error(`[transcribe] Error probing video file: ${err.message}`));
      }

      const hasAudio = metadata.streams.some((stream) => stream.codec_type === 'audio');

      if (!hasAudio) {
        console.log(`[transcribe] No audio stream found in ${video.filename}, skipping.`);
        return resolve(join(process.cwd(), 'audio', 'silence.wav')); // include path to silent WAV if no audio
      }

      ffmpeg(videoPath)
        .noVideo()
        .audioCodec('pcm_s16le')
        .audioFrequency(16000)
        .toFormat('wav')
        .on('error', (err) => reject(new Error(`[transcribe] Error processing audio: ${err.message}`)))
        .on('end', () => resolve(audioPath))
        .save(audioPath);
    });
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
    for (const [index, video] of videos.entries()) {
      console.log(`[transcribe] Generating transcripts: ${index + 1} of ${videos.length}`)
      const audioPath = await generateWavFile(video);
      if (audioPath) {
        await transcribeAudio(video, audioPath);
      } else {
        console.log(`[transcribe] Skipping transcription for ${video.filename} due to lack of audio stream.`);
      }
    }
  } catch (error) {
    console.error('[transcribe] Error processing transcriptions:', error.message);
  }
};

export default getTranscriptions;
