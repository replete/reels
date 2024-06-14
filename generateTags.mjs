import { Video, Tag, VideoTag } from './sequelize.mjs';
import { Op } from 'sequelize';

const generateTags = async () => {
  try {
    // Find videos with transcripts and missing tags
    const videos = await Video.findAll({
        where: {
          [Op.and]: [
            {
              transcript: {
                [Op.not]: null,
                [Op.ne]: ''
              }
            },
            {
              tags: {
                [Op.or]: [
                  { [Op.eq]: null },
                  { [Op.eq]: '' }
                ]
              }
            }
          ]
        }
      });


    for (const video of videos) {
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
        throw new Error(`HTTP error! Status: ${response.status}, Response: ${errorText}`);
      }

      const data = await response.json();
      console.log(`${data.response}
      
      
      `);
      let tags = data.response.replaceAll('_','-')
      tags = tags.replaceAll('#','')
      let rawTags = tags.split(/[\s,#]+/).filter(Boolean);
      rawTags = rawTags.map(tag => tag.replace(' ',''))
      console.log(video.transcript);
      console.log(rawTags);

      console.log(`Generated tags for ${video.filename}: ${tags}`);

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
    await video.update({ tags: rawTags.join(', ') });
    }
  } catch (error) {
    console.error('Error generating tags:', error.message);
  }
};

export default generateTags;
