// Copyright (c) 2010 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Copyright (c) 2014 Lu Wang <coolwanglu@gmail.com>

#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <utility>

#include "../fpdfsdk/include/fpdf_dataavail.h"
#include "../fpdfsdk/include/fpdf_ext.h"
#include "../fpdfsdk/include/fpdfformfill.h"
#include "../fpdfsdk/include/fpdftext.h"
#include "../fpdfsdk/include/fpdfview.h"

char * content_buffer = 0;
size_t content_buffer_len = 0;
size_t content_buffer_actual_len = 0;
bool loaded = false;

UNSUPPORT_INFO unsuppored_info;
FPDF_DOCUMENT doc;
FPDF_AVAIL pdf_avail;
FPDF_FORMHANDLE form;
IPDF_JSPLATFORM platform_callbacks;
FPDF_FORMFILLINFO form_callbacks;
FPDF_FILEACCESS file_access;
FX_FILEAVAIL file_avail;
FX_DOWNLOADHINTS hints;
TestLoader *loader;

int page_count = 0;
int scale = 1;

extern "C"
void PDFiumJS_init() {
    FPDF_InitLibrary(NULL);

    memset(&unsuppored_info, '\0', sizeof(unsuppored_info));
    unsuppored_info.version = 1;
    unsuppored_info.FSDK_UnSupport_Handler = Unsupported_Handler;

    FSDK_SetUnSpObjProcessHandler(&unsuppored_info);
}

extern "C"
void load() {
    if(loaded) {
      delete loader;
      FORM_DoDocumentAAction(form, FPDFDOC_AACTION_WC);
      FPDFDOC_ExitFormFillEnviroument(form);
      FPDF_CloseDocument(doc);
      FPDFAvail_Destroy(pdf_avail);
    }
    loaded = true;

    const char* pBuf = content_buffer;
    size_t len = content_buffer_actual_len;

    memset(&platform_callbacks, '\0', sizeof(platform_callbacks));
    platform_callbacks.version = 1;
    platform_callbacks.app_alert = Form_Alert;

    memset(&form_callbacks, '\0', sizeof(form_callbacks));
    form_callbacks.version = 1;
    form_callbacks.m_pJsPlatform = &platform_callbacks;

    loader = new TestLoader(pBuf, len);

    memset(&file_access, '\0', sizeof(file_access));
    file_access.m_FileLen = static_cast<unsigned long>(len);
    file_access.m_GetBlock = Get_Block;
    file_access.m_Param = loader;

    memset(&file_avail, '\0', sizeof(file_avail));
    file_avail.version = 1;
    file_avail.IsDataAvail = Is_Data_Avail;

    memset(&hints, '\0', sizeof(hints));
    hints.version = 1;
    hints.AddSegment = Add_Segment;

    pdf_avail = FPDFAvail_Create(&file_avail, &file_access);

    (void) FPDFAvail_IsDocAvail(pdf_avail, &hints);

    if (!FPDFAvail_IsLinearized(pdf_avail)) {
        doc = FPDF_LoadCustomDocument(&file_access, NULL);
    } else {
        doc = FPDFAvail_GetDocument(pdf_avail, NULL);
    }

    (void) FPDF_GetDocPermissions(doc);
    (void) FPDFAvail_IsFormAvail(pdf_avail, &hints);

    form = FPDFDOC_InitFormFillEnviroument(doc, &form_callbacks);
    FPDF_SetFormFieldHighlightColor(form, 0, 0xFFE4DD);
    FPDF_SetFormFieldHighlightAlpha(form, 100);

    int first_page = FPDFAvail_GetFirstPageNum(doc);
    (void) FPDFAvail_IsPageAvail(pdf_avail, first_page, &hints);

    page_count = FPDF_GetPageCount(doc);
    for (int i = 0; i < page_count; ++i) {
        (void) FPDFAvail_IsPageAvail(pdf_avail, i, &hints);
    }

    FORM_DoDocumentJSAction(form);
    FORM_DoDocumentOpenAction(form);
}


extern "C"
char * get_content_buffer(size_t len) {
    if(content_buffer_len < len) {
        free(content_buffer);
        content_buffer = (char*)malloc(len);
        content_buffer_len = len;
    }    
    content_buffer_actual_len = len;
    return content_buffer;
}

extern "C"
void render_to_canvas(int page_no, const char* buffer, int stride, int width, int height);

int Form_Alert(IPDF_JSPLATFORM*, FPDF_WIDESTRING, FPDF_WIDESTRING, int, int) {
  printf("Form_Alert called.\n");
  return 0;
}

void Unsupported_Handler(UNSUPPORT_INFO*, int type) {
  const char * feature = "Unknown";
  switch (type) {
    case FPDF_UNSP_DOC_XFAFORM:
      feature = "XFA";
      break;
    case FPDF_UNSP_DOC_PORTABLECOLLECTION:
      feature = "Portfolios_Packages";
      break;
    case FPDF_UNSP_DOC_ATTACHMENT:
    case FPDF_UNSP_ANNOT_ATTACHMENT:
      feature = "Attachment";
      break;
    case FPDF_UNSP_DOC_SECURITY:
      feature = "Rights_Management";
      break;
    case FPDF_UNSP_DOC_SHAREDREVIEW:
      feature = "Shared_Review";
      break;
    case FPDF_UNSP_DOC_SHAREDFORM_ACROBAT:
    case FPDF_UNSP_DOC_SHAREDFORM_FILESYSTEM:
    case FPDF_UNSP_DOC_SHAREDFORM_EMAIL:
      feature = "Shared_Form";
      break;
    case FPDF_UNSP_ANNOT_3DANNOT:
      feature = "3D";
      break;
    case FPDF_UNSP_ANNOT_MOVIE:
      feature = "Movie";
      break;
    case FPDF_UNSP_ANNOT_SOUND:
      feature = "Sound";
      break;
    case FPDF_UNSP_ANNOT_SCREEN_MEDIA:
    case FPDF_UNSP_ANNOT_SCREEN_RICHMEDIA:
      feature = "Screen";
      break;
    case FPDF_UNSP_ANNOT_SIG:
      feature = "Digital_Signature";
      break;
  }
  printf("Unsupported feature: %s.\n", feature);
}

class TestLoader {
 public:
  TestLoader(const char* pBuf, size_t len);

  const char* m_pBuf;
  size_t m_Len;
};

TestLoader::TestLoader(const char* pBuf, size_t len)
    : m_pBuf(pBuf), m_Len(len) {
}

int Get_Block(void* param, unsigned long pos, unsigned char* pBuf,
              unsigned long size) {
  TestLoader* pLoader = (TestLoader*) param;
  if (pos + size < pos || pos + size > pLoader->m_Len) return 0;
  memcpy(pBuf, pLoader->m_pBuf + pos, size);
  return 1;
}

bool Is_Data_Avail(FX_FILEAVAIL* pThis, size_t offset, size_t size) {
  return true;
}

void Add_Segment(FX_DOWNLOADHINTS* pThis, size_t offset, size_t size) {
}


extern "C"
int get_page_count() {
    return page_count;
}

extern "C"
void set_scale(int s) {
    scale = s;
}


extern "C"
void render_page(int i) {
    FPDF_PAGE page = FPDF_LoadPage(doc, i);
    FPDF_TEXTPAGE text_page = FPDFText_LoadPage(page);
    FORM_OnAfterLoadPage(page, form);
    FORM_DoPageAAction(page, form, FPDFPAGE_AACTION_OPEN);

    int width = static_cast<int>(FPDF_GetPageWidth(page)) * scale;
    int height = static_cast<int>(FPDF_GetPageHeight(page)) * scale;
    FPDF_BITMAP bitmap = FPDFBitmap_Create(width, height, 0);
    FPDFBitmap_FillRect(bitmap, 0, 0, width, height, 0xFFFFFFFF);

    FPDF_RenderPageBitmap(bitmap, page, 0, 0, width, height, 0, 0);
    FPDF_FFLDraw(form, bitmap, page, 0, 0, width, height, 0, 0);

    const char* buffer = reinterpret_cast<const char*>(FPDFBitmap_GetBuffer(bitmap));
    int stride = FPDFBitmap_GetStride(bitmap);
    render_to_canvas(i, buffer, stride, width, height);

    FPDFBitmap_Destroy(bitmap);

    FORM_DoPageAAction(page, form, FPDFPAGE_AACTION_CLOSE);
    FORM_OnBeforeClosePage(page, form);
    FPDFText_ClosePage(text_page);
    FPDF_ClosePage(page);
}

