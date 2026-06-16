import { EventPipeline, FileBronzeStorage, InMemoryEventPublisher } from "@morgan/events";
import { env } from "../config.js";

const publisher = new InMemoryEventPublisher();
const bronze = new FileBronzeStorage(env.BRONZE_STORAGE_PATH);

export const eventPipeline = new EventPipeline(publisher, bronze);

export function getPublishedEvents() {
  return publisher.events;
}
