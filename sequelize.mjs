import { Sequelize, DataTypes } from 'sequelize';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: join(__dirname, 'database.sqlite'),
});

const Video = sequelize.define('Video', {
  slug: {
    type: DataTypes.STRING,
    unique: true,
  },
  filename: DataTypes.STRING,
  thumbnail: DataTypes.STRING,
  transcript: DataTypes.TEXT,
  tags: DataTypes.STRING,
});

await sequelize.sync();

export { sequelize, Video };