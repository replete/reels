import { join, basename, extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import { Video } from './sequelize.mjs';

const videosDir = join(process.cwd(), 'videos');
const thumbsDir = join(process.cwd(), 'thumbs');

if (!existsSync(thumbsDir)) {
  mkdirSync(thumbsDir);
}

const generateThumbnail = async (video) => {
  const inputPath = join(videosDir, video.filename);
  const outputFilename = `${basename(video.filename, extname(video.filename))}.jpg`;
  const outputPath = join(thumbsDir, outputFilename);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .on('end', async () => {
        await video.update({ thumbnail: outputFilename });
        resolve();
      })
      .on('error', reject)
      .screenshot({
        count: 1,
        folder: thumbsDir,
        filename: outputFilename,
        size: '50%'
      });
  });
};

const generateThumbnails = async () => {
  try {
    const videos = await Video.findAll({ where: { thumbnail: null } });
    for (const [index, video] of videos.entries()) {
      console.log(`[thumbnails] Generating thumbnail ${index + 1} of ${videos.count}`)
      await generateThumbnail(video);
    }
  } catch (err) {
    console.error('[thumbnails] Error generating thumbnails:', err);
  }
};

export default generateThumbnails;