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

struct {
    UNSUPPORT_INFO unsuppored_info;
} global;

extern "C"
int PDFiumJS_read_file(void *file_id, unsigned long pos, unsigned char *pBuf, unsigned long size);

struct PDFiumJS_Doc {
    PDFiumJS_Doc(void *file_id, size_t len) {
        memset(&platform_callbacks, '\0', sizeof(platform_callbacks));
        platform_callbacks.version = 1;
        platform_callbacks.app_alert = Form_Alert;

        memset(&form_callbacks, '\0', sizeof(form_callbacks));
        form_callbacks.version = 1;
        form_callbacks.m_pJsPlatform = &platform_callbacks;

        memset(&file_access, '\0', sizeof(file_access));
        file_access.m_FileLen = static_cast<unsigned long>(len);
        file_access.m_GetBlock = PDFiumJS_read_file;
        file_access.m_Param = file_id;

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

        /*
        int first_page = FPDFAvail_GetFirstPageNum(doc);
        (void) FPDFAvail_IsPageAvail(pdf_avail, first_page, &hints);
        */

        page_count = FPDF_GetPageCount(doc);
        printf("%d\n", page_count);
        for (int i = 0; i < page_count; ++i) {
            (void) FPDFAvail_IsPageAvail(pdf_avail, i, &hints);
        }

        FORM_DoDocumentJSAction(form);
        FORM_DoDocumentOpenAction(form);
    }

    ~PDFiumJS_Doc() {
        FORM_DoDocumentAAction(form, FPDFDOC_AACTION_WC);
        FPDFDOC_ExitFormFillEnviroument(form);
        FPDF_CloseDocument(doc);
        FPDFAvail_Destroy(pdf_avail);
    }

    static
    int Form_Alert(IPDF_JSPLATFORM*, FPDF_WIDESTRING, FPDF_WIDESTRING, int, int) {
      printf("Form_Alert called.\n");
      return 0;
    }

    static
    bool Is_Data_Avail(FX_FILEAVAIL *pThis, size_t offset, size_t size) {
      return true;
    }

    static
    void Add_Segment(FX_DOWNLOADHINTS *pThis, size_t offset, size_t size) {
    }

    IPDF_JSPLATFORM platform_callbacks;
    FPDF_FORMFILLINFO form_callbacks;
    FPDF_FILEACCESS file_access;
    FX_FILEAVAIL file_avail;
    FX_DOWNLOADHINTS hints;
    FPDF_AVAIL pdf_avail;
    FPDF_DOCUMENT doc;
    FPDF_FORMHANDLE form;
    int page_count;
};

struct PDFiumJS_Page {
    PDFiumJS_Page(FPDF_PAGE page, PDFiumJS_Doc *doc) 
        : page(page), doc(doc) 
    { }
    FPDF_PAGE page;
    PDFiumJS_Doc *doc;
};

static
void Unsupported_Handler(UNSUPPORT_INFO*, int type) {
  const char *feature = "Unknown";
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

extern "C"
void PDFiumJS_init() {
    FPDF_InitLibrary(NULL);

    UNSUPPORT_INFO& unsuppored_info = global.unsuppored_info;
    memset(&unsuppored_info, '\0', sizeof(unsuppored_info));
    unsuppored_info.version = 1;
    unsuppored_info.FSDK_UnSupport_Handler = Unsupported_Handler;
    FSDK_SetUnSpObjProcessHandler(&unsuppored_info);
}

extern "C"
PDFiumJS_Doc *PDFiumJS_Doc_new(void *file_id, size_t len) {
    return new PDFiumJS_Doc(file_id, len);
}

extern "C"
void PDFiumJS_Doc_delete(PDFiumJS_Doc *doc) {
    delete doc;
}

extern "C"
int PDFiumJS_Doc_get_page_count(PDFiumJS_Doc *doc) {
    return doc->page_count;
}

extern "C"
PDFiumJS_Page *PDFiumJS_Doc_get_page(PDFiumJS_Doc *doc, int page_no) {
    FPDF_PAGE page = FPDF_LoadPage(doc->doc, page_no);
    FORM_OnAfterLoadPage(page, doc->form);
    FORM_DoPageAAction(page, doc->form, FPDFPAGE_AACTION_OPEN);
    return new PDFiumJS_Page(page, doc);
}

extern "C"
int PDFiumJS_Page_get_width(PDFiumJS_Page *page) {
    return static_cast<int>(FPDF_GetPageWidth(page->page));
}

extern "C"
int PDFiumJS_Page_get_height(PDFiumJS_Page *page) {
    return static_cast<int>(FPDF_GetPageHeight(page->page));
}

extern "C"
FPDF_BITMAP PDFiumJS_Page_get_bitmap(PDFiumJS_Page *page, int width, int height) {
    FPDF_BITMAP bitmap = FPDFBitmap_Create(width, height, 0);
    FPDFBitmap_FillRect(bitmap, 0, 0, width, height, 0xFFFFFFFF);

    FPDF_RenderPageBitmap(bitmap, page->page, 0, 0, width, height, 0, 0);
    FPDF_FFLDraw(page->doc->form, bitmap, page->page, 0, 0, width, height, 0, 0);

    return bitmap;
}

extern "C"
const char *PDFiumJS_Bitmap_get_buffer(FPDF_BITMAP bitmap) {
    return reinterpret_cast<const char*>(FPDFBitmap_GetBuffer(bitmap));
}

extern "C"
int PDFiumJS_Bitmap_get_stride(FPDF_BITMAP bitmap) {
    return FPDFBitmap_GetStride(bitmap);
}

extern "C"
void PDFiumJS_Bitmap_destroy(FPDF_BITMAP bitmap) {
    FPDFBitmap_Destroy(bitmap);
}

extern "C"
void PDFiumJS_Page_destroy(PDFiumJS_Page *page) {
    FORM_DoPageAAction(page->page, page->doc->form, FPDFPAGE_AACTION_CLOSE);
    FORM_OnBeforeClosePage(page->page, page->doc->form);
    //FPDFText_ClosePage(text_page);
    FPDF_ClosePage(page->page);
    delete page;
}

