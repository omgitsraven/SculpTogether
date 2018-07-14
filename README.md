# SculpTogether
SculpTogether is a multi-user 3D drawing app, written to run on the Altspace platform. It runs in JavaScript in a webpage, but currently depends on Altspace's API in many places, and is designed around the limitations of Altspace's implementation of three.js in many more places. (For example, Altspace cannot change meshes after they are created, so ongoing strokes are displayed as a series of many separate quad objects in order to update in real-time, and then coalesced into a new single object in order to save on draw calls once the user is finished drawing that stroke.)

Networking and saving/loading is done through Firebase. If you'd like to run your own server, make a copy of `credentials_dummy.js` that contains your Firebase server's credentials, and substitute its filename in place of `credentials_debug` in the `jsFilesToLoad` array in `index.html`. (The page will not load otherwise.)

This is not the most clearly-organized project unfortunately (it grew a bit sprawlingly as features were added) so feel free to ask me if you have questions about how things work, or why they were done that way, or where to look for the code that handles a particular thing.

I hope you can learn some useful things from this code, even in its relatively-undocumented state; in accordance with the license, please just give credit for any substantial portions you use in your own projects!

Thanks for reading!
