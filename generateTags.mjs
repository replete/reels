import { Video, Tag, VideoTag } from './sequelize.mjs';
import sequelize from './sequelize.mjs';

const generateTags = async () => {
  try {

    const [videos] = await sequelize.query(`
      SELECT *
      FROM Videos
      WHERE 
        transcript IS NOT NULL
        AND transcript != ''
        AND transcript != '-'
        AND LENGTH(transcript) > 150
        AND (tags IS NULL OR tags = '')
    `);

    for (const [index, video] of videos.entries()) {

      console.log(`[tags] Generating tags from videos: ${index + 1} of ${videos.length}`)

      const prompt = `Generate 5-10 topical hashtags from the following video transcript. Each hashtag should be a single word or phrase, as simple as possible. Use dashes, never underscores. Only include the hashtags in the response, comma-separated, on a single line. Example format: health, gym, exercise, squats.
      "${video.transcript}"`;

      // Call the Ollama API
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.replace(/(\r\n|\r|\n)/g, '\\n'),
          model: 'dolphin-llama3:latest',
          stream: false
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`[tags] HTTP error! Status: ${response.status}, Response: ${errorText}`);
      }

      const data = await response.json();

      // Cleanup tags
      let tags = data.response.replaceAll('_','-');
      tags = tags.replaceAll('#','');
      tags = tags.replaceAll(`'`,'');
      tags = tags.replaceAll(`- `,'');
      tags = tags.toLowerCase();
      let rawTags = tags.split(/[\s,#]+/).filter(Boolean);
      rawTags = rawTags.map(tag => tag.replaceAll(' ',''));

      await console.log(video.transcript);
      console.log(`[tags] Generated tags for ${video.filename}: ${rawTags.join(',')}`);

    // Process each tag
    for (const tagName of rawTags) {
        const [tag, created] = await Tag.findOrCreate({
        where: { name: tagName.toLowerCase() },
        });

        // Associate the tag with the video
        await VideoTag.findOrCreate({
        where: {
            VideoId: video.id,
            TagId: tag.id,
        },
        });
    }

    // Mark the video as having tags
    const model = await Video.findByPk(video.id);
    model.update({ tags: rawTags.join(', ') });

    }
  } 
  catch (error) {
    console.error('[tags] Error generating tags:', error);
  }
};

export default generateTags;
