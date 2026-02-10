## Roadmap

1. Convert the Library and the popup into react to make it better for reuse and maintainability.

2. Overhaul the enhance system by making the chapter into chunks by default dependent on user configurable Chunk_Size set to default at 3000 words
   1. If the chapter size < Chunk_Size then it is a single chunk
   2. If the chapter size < 2 * Chunk_Size then the remaining words will be split roughly equally into 2 chunks
   3. If the chapter size > Chunk_Size then it is split into multiple chunks of Chunk_Size words except the last two chunks like in point `4.2`
   4. Each chunk will have it's own regenerate, caching system, show original and such buttons
   5. The other buttons of long and short summary will stay at the top but will also be repeated for user configurable number of chunks (Chunk_Summary_Count default 2) this will make the summary buttons repeat for every 2 chunks or so and will get the summary only for those 2 chunks and will have to be repeated this is to not lose any data when the chapters are too long

3. I want modularity in the following:
   1. Websites using handlers in ../src/utils/website-handlers
   2. In the library Websites pages using handlers in ../src/library/websites
   3. In future for the AI service like OpenAI, Deepseek, etc. using handlers in ../src/utils/model-handlers (Far in future)
   4. Expand the library to also have the option to download their novels in ebook forms like epub and such while keeping all the necessary meta data from the library about the story (simply to integrate next major version only cloudflare cache bypass issue)
   5. Make the backup system better and more modular to allow for future backup services like Dropbox, OneDrive, etc. (future)
   6. Make a common platform like service for dealing with readers like fbreader and directly sync the novels with them. (far in future)

4. Enhance the library to be better done with more comprehensive settings

5. Make the extension more accessible by adding keyboard shortcuts for more actions and better screen reader support (future)

6. Make the popup better designed and more user friendly

7. Make the notification system better by adding a notification center page in the library and popup with better notification grouping and handling

8. Make the AI model settings better by adding presets for different use cases like creative writing, technical writing, etc. (future)

9. Make the theme system better by adding more themes and allowing users to create their own themes (future)

10. Improve the performance of the extension by optimizing the code and reducing the memory usage (ongoing)

11. Add more websites to the supported list by creating new handlers (ongoing)

12. Improve the testing coverage of the extension by adding more unit and integration tests (ongoing)

13. Improve the documentation of the extension by adding more examples and tutorials (ongoing)

14. Gather user feedback and suggestions to improve the extension (ongoing)
