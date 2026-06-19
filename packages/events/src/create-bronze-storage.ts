import { FileBronzeStorage } from "./storage.js";
import { createS3BronzeStorage } from "./s3-bronze.js";
import type { BronzeStorage } from "./types.js";

export type BronzeStorageBackend = "filesystem" | "s3";

export type CreateBronzeStorageOptions = {
  backend: BronzeStorageBackend;
  filesystemPath?: string;
  s3Bucket?: string;
  s3Region?: string;
};

export async function createBronzeStorage(options: CreateBronzeStorageOptions): Promise<BronzeStorage> {
  if (options.backend === "s3") {
    const bucket = options.s3Bucket ?? "bronze";
    return createS3BronzeStorage(bucket, options.s3Region);
  }

  return new FileBronzeStorage(options.filesystemPath ?? "./data/bronze");
}
