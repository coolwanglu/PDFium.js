mergeInto(LibraryManager.library, {
    render_to_canvas: function(page_no, buf, stride, width, height) {
        Module['render'](page_no, buf, stride, width, height);
    }
});
