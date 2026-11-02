<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- The board, hotdog and sugar jar are illustrated PNGs in src/assets drawn onto the canvas; sugar is masked to the hotdog image's alpha so it never lands on the stick or board.
- Sauce choices use individual illustrated bottle-and-dollop assets and the shared Button component; CSS grid places them beside the canvas on desktop and after it on mobile so drawing coordinates stay independent of layout.
- Sauce rendering lives in a browser-safe brush module: union consecutive same-sauce masks and shade their local distance field in logical coordinates, so crossings, live drawing, undo and export share stable texture while different sauces retain drawing order.
- Food tools retain decorations in logical surface coordinates; one scene renderer handles transitions, transformed hit testing and PNG output to keep editing and exports aligned.
- Tool audio uses reusable noise sources with cancellable gesture envelopes so interrupted or pending gestures cannot restart sound after mute or cancellation.
