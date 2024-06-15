import { Video, Tag, VideoTag } from './sequelize.mjs';
import sequelize from './sequelize.mjs';

const generateTags = async () => {
  // try {

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

      // const prompt = `Generate 5-10 topical hashtags from the following video transcript. Each hashtag should be a single word or phrase, as simple as possible. Use dashes, never underscores. Only include the hashtags in the response, comma-separated, on a single line.
      // "${video.transcript}"`;

      const system = `You are an assistant that summarizes video transcripts into hashtags. The hashtags should follow these rules:
      1. Make sure you only use 1 word, never multiple
      2. Only use A-Z and -.
      4. Return results as a comma-separated list.`;
      const prompt = `
      Summarize the following video transcript into six hashtags, the tag should be a single word like a topic category

      "${video.transcript}"
      
      Example of the required format: self-help, motivation, exercise, gym, squats, health
      `;

      // Call the Ollama API
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          system,
          prompt: prompt.replace(/(\r\n|\r|\n)/g, '\\n'),
          model: 'qwen2:7b-instruct-q8_0',
          stream: false
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`[tags] HTTP error! Status: ${response.status}, Response: ${errorText}`);
      }

      const data = await response.json();

      // Cleanup tags
      let tags = data.response
        .replace(/[^A-Za-z,-]/g, '') // Remove != A-Z or a-z or - or , characters
        .toLowerCase();
      let rawTags = tags.split(/[\s,#]+/).filter(Boolean); // split into array

      console.log(`[tags] Transcription for ${video.filename}, id ${video.id}:
      "${video.transcript}"

      Tags: ${rawTags.join(',')}
      
      `);
      console.log(rawTags);

    for (const tagName of rawTags) {
      const [tag, created] = await Tag.findOrCreate({
        where: { name: tagName.toLowerCase() },
      });

      await VideoTag.findOrCreate({
        where: {
            VideoId: video.id,
            TagId: tag.id,
        },
      });
    }

    const model = await Video.findByPk(video.id);
    model.update({ tags: rawTags.join(', ') });

    }
  // } 
  // catch (error) {
  //   console.error('[tags] Error generating tags:', error);
  // }
};

export default generateTags;
