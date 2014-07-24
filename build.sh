#!/bin/bash
set -e
[ -z $EM_DIR] && EM_DIR=~/src/emscripten

do_config() {
    build/gyp_pdfium
}

do_make() {
$EM_DIR/emmake make BUILDTYPE=Release -j8
}

do_link() {
mkdir web || true
$EM_DIR/em++ \
    -Oz \
    --llvm-lto 1 \
    -s EXPORTED_FUNCTIONS="['_PDFiumJS_init', '_PDFiumJS_Doc_new', '_PDFiumJS_Doc_delete', '_PDFiumJS_Doc_get_page_count', '_PDFiumJS_Doc_get_page', '_PDFiumJS_Page_get_width', '_PDFiumJS_Page_get_height', '_PDFiumJS_Page_get_bitmap', '_PDFiumJS_Bitmap_get_buffer', '_PDFiumJS_Bitmap_get_stride', '_PDFiumJS_Bitmap_destroy', '_PDFiumJS_Page_destroy']" \
    -o web/pdfium.js \
    -Wl,--start-group out/Release/obj.target/pdfium_js/pdfium.js/pdfium.js.o out/Release/obj.target/libpdfium.a out/Release/obj.target/libfdrm.a out/Release/obj.target/libfpdfdoc.a out/Release/obj.target/libfpdfapi.a out/Release/obj.target/libfpdftext.a out/Release/obj.target/libformfiller.a out/Release/obj.target/libfxcodec.a out/Release/obj.target/libfxcrt.a out/Release/obj.target/libfxedit.a out/Release/obj.target/libfxge.a out/Release/obj.target/libpdfwindow.a -Wl,--end-group

}

do_config
do_make
do_link

