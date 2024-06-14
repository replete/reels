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

const Tag = sequelize.define('Tag', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
});

const VideoTag = sequelize.define('VideoTag', {
  VideoId: {
    type: DataTypes.INTEGER,
    references: {
      model: Video,
      key: 'id',
    },
  },
  TagId: {
    type: DataTypes.INTEGER,
    references: {
      model: Tag,
      key: 'id',
    },
  },
});

Video.belongsToMany(Tag, { through: VideoTag });
Tag.belongsToMany(Video, { through: VideoTag });

await sequelize.sync();

export { sequelize, Video, Tag, VideoTag };