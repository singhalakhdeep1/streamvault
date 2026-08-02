// HLS/DASH streaming service for streamvault

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class StreamingService {
  async generateHLS(inputPath: string, outputPath: string) {
    const command = `ffmpeg -i ${inputPath} -c:v libx264 -c:a aac -f hls -hls_time 10 -hls_list_size 0 ${outputPath}/playlist.m3u8`;
    await execAsync(command);
    return { outputPath, format: 'hls' };
  }

  async generateDASH(inputPath: string, outputPath: string) {
    const command = `ffmpeg -i ${inputPath} -c:v libx264 -c:a aac -f dash -seg_duration 10 ${outputPath}/manifest.mpd`;
    await execAsync(command);
    return { outputPath, format: 'dash' };
  }

  async generateMultiBitrateHLS(inputPath: string, outputPath: string, bitrates: number[]) {
    const commands = bitrates.map(bitrate => 
      `-vf "scale=-2:${bitrate}" -b:v ${bitrate}k -maxrate ${bitrate}k -bufsize ${bitrate * 2}k`
    );
    
    const command = `ffmpeg -i ${inputPath} ${commands.join(' ')} -f hls -hls_time 10 -hls_playlist_type vod ${outputPath}/master.m3u8`;
    await execAsync(command);
    return { outputPath, format: 'hls', bitrates };
  }

  async extractThumbnail(inputPath: string, outputPath: string, timestamp = '00:00:01') {
    const command = `ffmpeg -i ${inputPath} -ss ${timestamp} -vframes 1 ${outputPath}`;
    await execAsync(command);
    return { outputPath, timestamp };
  }

  async generatePreview(inputPath: string, outputPath: string, duration = 5) {
    const command = `ffmpeg -i ${inputPath} -t ${duration} -vf "fps=10,scale=320:-1" -y ${outputPath}`;
    await execAsync(command);
    return { outputPath, duration };
  }

  async getVideoInfo(inputPath: string) {
    const command = `ffprobe -v quiet -print_format json -show_format -show_streams ${inputPath}`;
    const { stdout } = await execAsync(command);
    return JSON.parse(stdout);
  }

  async transcodeToFormat(inputPath: string, outputPath: string, format: string) {
    const command = `ffmpeg -i ${inputPath} -c:v libx264 -c:a aac ${outputPath}`;
    await execAsync(command);
    return { outputPath, format };
  }

  async addWatermark(inputPath: string, watermarkPath: string, outputPath: string) {
    const command = `ffmpeg -i ${inputPath} -i ${watermarkPath} -filter_complex "overlay=10:10" ${outputPath}`;
    await execAsync(command);
    return { outputPath };
  }

  async concatenateVideos(inputPaths: string[], outputPath: string) {
    const listFile = 'concat_list.txt';
    const listContent = inputPaths.map(path => `file '${path}'`).join('\n');
    await execAsync(`echo "${listContent}" > ${listFile}`);
    const command = `ffmpeg -f concat -safe 0 -i ${listFile} -c copy ${outputPath}`;
    await execAsync(command);
    await execAsync(`rm ${listFile}`);
    return { outputPath };
  }
}

export default StreamingService;
