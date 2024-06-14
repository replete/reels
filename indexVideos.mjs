import { readdir } from 'fs/promises';
import { join } from 'path';
import sanitize from 'sanitize-filename';
import { Video } from './sequelize.mjs';

const videosDir = join(process.cwd(), 'videos');

const indexVideos = async () => {
  try {
    const files = await readdir(videosDir);
    for (const file of files) {
      if (file.endsWith('.mp4')) {
        const slug = sanitize(file.replace(/\s+/g, '_'));
        await Video.findOrCreate({
          where: { filename: file },
          defaults: { slug, filename: file },
        });
      }
    }
  } catch (err) {
    console.error('Error indexing videos:', err);
  }
};

export default indexVideos
