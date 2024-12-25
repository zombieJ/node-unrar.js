import { SeekMethod } from './Extractor';

export class DataFile {
  private buffers: Uint8Array[];
  private size: number;
  private pos: number;
  private stream: ReadableStreamDefaultReader<Uint8Array> | null;
  private streamBuffer: Uint8Array | null;
  private streamPos: number;

  constructor(data?: Uint8Array | ReadableStream<Uint8Array>) {
    this.buffers = [];
    this.pos = 0;
    this.size = 0;
    this.stream = null;
    this.streamBuffer = null;
    this.streamPos = 0;

    if (data instanceof Uint8Array) {
      this.buffers.push(data);
      this.size = data.byteLength;
      this.pos = 0;
    } else if (data instanceof ReadableStream) {
      this.stream = data.getReader();
    }
  }

  public async read(size: number): Promise<Uint8Array | null> {
    await this.loadStreamData(size);
    this.flatten();
    if (size + this.pos > this.size) {
      return null;
    }
    const oldPos = this.pos;
    this.pos += size;
    return this.buffers[0].slice(oldPos, this.pos);
  }

  public async readAll(): Promise<Uint8Array> {
    await this.loadStreamData(Infinity);
    this.flatten();
    return this.buffers[0] || new Uint8Array();
  }

  public write(data: Uint8Array): boolean {
    this.buffers.push(data);
    this.size += data.byteLength;
    this.pos += data.byteLength;
    return true;
  }

  public tell(): number {
    return this.pos;
  }

  public seek(pos: number, method: SeekMethod): boolean {
    let newPos = this.pos;
    if (method === 'SET') {
      newPos = pos;
    } else if (method === 'CUR') {
      newPos += pos;
    } else {
      newPos = this.size - pos;
    }
    if (newPos < 0 || newPos > this.size) {
      return false;
    }
    this.pos = newPos;
    return true;
  }

  private flatten(): void {
    if (this.buffers.length <= 1) {
      return;
    }
    const newBuffer = new Uint8Array(this.size);
    let offset = 0;
    for (const buffer of this.buffers) {
      newBuffer.set(buffer, offset);
      offset += buffer.byteLength;
    }
    this.buffers = [newBuffer];
  }

  private async loadStreamData(size: number): Promise<void> {
    if (!this.stream) {
      return;
    }

    while (this.size < this.pos + size) {
      if (this.streamBuffer) {
        const remaining = this.streamBuffer.byteLength - this.streamPos;
        const toCopy = Math.min(size, remaining);
        this.buffers.push(this.streamBuffer.subarray(this.streamPos, this.streamPos + toCopy));
        this.size += toCopy;
        this.pos += toCopy;
        this.streamPos += toCopy;

        if (this.streamPos >= this.streamBuffer.byteLength) {
          this.streamBuffer = null;
          this.streamPos = 0;
        }
      } else {
        const { value, done } = await this.stream.read();
        if (done) {
          this.stream = null;
          break;
        }
        this.streamBuffer = value;
        this.streamPos = 0;
      }
    }
  }
}
