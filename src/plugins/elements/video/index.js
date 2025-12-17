import { createElementPlugin } from "../elementPlugin.js";
import { addVideo } from "./addVideo.js";
import { updateVideo } from "./updateVideo.js";
import { deleteVideo } from "./deleteVideo.js";
import { parseVideo } from "./parseVideo.js";

// Export the video plugin
export const videoPlugin = createElementPlugin({
  type: "video",
  add: addVideo,
  update: updateVideo,
  delete: deleteVideo,
  parse: parseVideo,
});
