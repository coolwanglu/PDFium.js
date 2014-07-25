mergeInto(LibraryManager.library, {
  PDFiumJS_read_file: function(file_id, pos, pBuf, size) {
    var input = PDFiumJS.opened_files[file_id];
    if(!input) return 0;
    if(pos + size < pos ||pos + size > input.length) return 0;
    HEAPU8.set(input.subarray(pos, pos+size), pBuf);
    return 1;
  },
});
