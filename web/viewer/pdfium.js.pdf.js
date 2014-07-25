/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab foldmethod=marker: */
/*
 * PDFium.js adapter for PDF.js
 *
 * by Lu Wang
 */

if (typeof PDFiumJS === 'undefined') {
  (typeof window !== 'undefined' ? window : this).PDFiumJS = {};
}

var crawp = Module['crap'];
PDFiumJS.C = {
  init: cwrap('PDFiumJS_init', null, []),
  Doc_new: cwrap('PDFiumJS_Doc_new', 'number', ['number', 'number']),
  Doc_delete: cwrap('PDFiumJS_Doc_delete', null, ['number']),
  Doc_get_page_count: cwrap('PDFiumJS_Doc_get_page_count', 'number', ['number']),
  Doc_get_page: cwrap('PDFiumJS_Doc_get_page', 'number', ['number', 'number']),
  Page_get_width: cwrap('PDFiumJS_Page_get_width', 'number', ['number']),
  Page_get_height: cwrap('PDFiumJS_Page_get_height', 'number', ['number']),
  Page_get_bitmap: cwrap('PDFiumJS_Page_get_bitmap', 'number', ['number']),
  Bitmap_get_buffer: cwrap('PDFiumJS_Bitmap_get_buffer', 'number', ['number']),
  Bitmap_get_stride: cwrap('PDFiumJS_Bitmap_get_stride', 'number', ['number']),
  Bitmap_destroy: cwrap('PDFiumJS_Bitmap_destroy', null, ['number']),
  Page_destroy: cwrap('PDFiumJS_Page_destroy', null, ['number']),
};
PDFiumJS.C.init();

PDFiumJS.createFakePromise = function() { 
  var args = arguments;
  return { 
    then: function(f){ 
      if(f) {
        setTimeout(function() {
          f.apply(null, args);
        }, 1);
      }
      return PDFiumJS.createFakePromise();
    } 
  }; 
};
PDFiumJS.createFakeFailedPromise = function() { 
  var args = arguments;
  return { 
    then: function(unused, f){ 
      if(f) {
        setTimeout(function() {
          f.apply(null, args);
        }, 1);
      }
    } 
  }; 
};

PDFiumJS.opened_files = [];

PDFiumJS.Doc = function (data) {
  this.file_size = data.length;
  if(!data) {
    this.numPages = 0;
    return;
  }

  var file_id = PDFiumJS.opened_files.length;
  PDFiumJS.opened_files[file_id] = data;

  this.doc = PDFiumJS.C.Doc_new(file_id, this.file_size);
  this.numPages = PDFiumJS.C.Doc_get_page_count(this.doc);
};
PDFiumJS.Doc.prototype = {
  destroy: function () {
    PDFiumJS.C.Doc_delete(this.doc);
  },
  getDownloadInfo: function() {
    return PDFiumJS.createFakePromise({ length: this.file_size });
  },
  getPage: function(page_no) {
    return PDFiumJS.createFakePromise( new PDFiumJS.Page(page_no-1, this.doc));
  },
  getDestinations: function() { return PDFiumJS.createFakePromise(); },
  getMetadata: function() { 
    return PDFiumJS.createFakePromise({ 
      info: {},
      metadata: { 
        has: function() { return false; }
      },
    }); 
  },
  getOutline: function() { return PDFiumJS.createFakePromise(); },
  getJavaScript: function() { return PDFiumJS.createFakePromise([]); },
  getAttachments: function() { return PDFiumJS.createFakePromise(); },
  cleanup: function() { },
};

PDFiumJS.Page = function (page_no, doc) {
  this.page_no = page_no;
  this.doc = doc;

  var page = PDFiumJS.C.Doc_get_page(this.doc, page_no);
  this.width = PDFiumJS.C.Page_get_width(page);
  this.height = PDFiumJS.C.Page_get_height(page);
  this.ref = { num:0, gen:0 };
  // TODO better memory management
  PDFiumJS.C.Page_destroy(page);
};
PDFiumJS.Page.prototype = {
  getViewport: function(scale, rotate) {
    return new PDFJS.PageViewport([0,0,this.width,this.height], scale, rotate, 0, 0);
  },
  getAnnotations: function() {
    return PDFiumJS.createFakePromise([]);
  },
  getTextContent: function() {
    return PDFiumJS.createFakePromise({ items: [] });
  },
  render: function(params) {//{{{
    try {
      var ctx = params.canvasContext;
      var width = ctx.canvas.width;
      var height = ctx.canvas.height;

      var img = ctx.createImageData(width, height);
      var data = img.data;

      // TODO better memory management
      var page = PDFiumJS.C.Doc_get_page(this.doc, this.page_no);

      var bitmap = PDFiumJS.C.Page_get_bitmap(page, width, height);

      PDFiumJS.C.Page_destroy(page);

      var buf = PDFiumJS.C.Bitmap_get_buffer(bitmap);
      var stride = PDFiumJS.C.Bitmap_get_stride(bitmap);

      var off = 0;
      for(var h = 0; h < height; ++h) {
        var ptr = buf + stride * h;
        for(var w = 0; w < width; ++w) {
          data[off++] = HEAPU8[ptr+2];
          data[off++] = HEAPU8[ptr+1];
          data[off++] = HEAPU8[ptr];
          data[off++] = 255;
          ptr += 4;
        }
      }

      PDFiumJS.C.Bitmap_destroy(bitmap);

      ctx.putImageData(img, 0, 0);
    } catch(e) {
      return {
        promise: PDFiumJS.createFakeFailedPromise({ message: e }),
      };
    }

    return { 
      promise: PDFiumJS.createFakePromise(),
      cancel: function() { },
    };
  },//}}}
  cleanup: function() { 
  },
  destroy: function() {
  },
};

if (typeof PDFJS === 'undefined') {
  (typeof window !== 'undefined' ? window : this).PDFJS = {};
}

PDFJS.disableWorker = true;
PDFJS.disableCreateObjectURL = true;
PDFJS.disableTextLayer = true;

PDFJS.UnsupportedManager = { listen: function() {} };
PDFJS.isValidUrl = function() { return true; };

PDFJS.getDocument = function (data) {
  data = data.data;
  if(data)
    return PDFiumJS.createFakePromise(new PDFiumJS.Doc(data));
  else
    return PDFiumJS.createFakeFailedPromise('Only local files are supported');
};

// The following is taken from PDF.js
/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var Util = PDFJS.Util = (function UtilClosure() {//{{{
  function Util() {}

  var rgbBuf = ['rgb(', 0, ',', 0, ',', 0, ')'];

  // makeCssRgb() can be called thousands of times. Using |rgbBuf| avoids
  // creating many intermediate strings.
  Util.makeCssRgb = function Util_makeCssRgb(rgb) {
    rgbBuf[1] = rgb[0];
    rgbBuf[3] = rgb[1];
    rgbBuf[5] = rgb[2];
    return rgbBuf.join('');
  };

  // Concatenates two transformation matrices together and returns the result.
  Util.transform = function Util_transform(m1, m2) {
    return [
      m1[0] * m2[0] + m1[2] * m2[1],
      m1[1] * m2[0] + m1[3] * m2[1],
      m1[0] * m2[2] + m1[2] * m2[3],
      m1[1] * m2[2] + m1[3] * m2[3],
      m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
      m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
    ];
  };

  // For 2d affine transforms
  Util.applyTransform = function Util_applyTransform(p, m) {
    var xt = p[0] * m[0] + p[1] * m[2] + m[4];
    var yt = p[0] * m[1] + p[1] * m[3] + m[5];
    return [xt, yt];
  };

  Util.applyInverseTransform = function Util_applyInverseTransform(p, m) {
    var d = m[0] * m[3] - m[1] * m[2];
    var xt = (p[0] * m[3] - p[1] * m[2] + m[2] * m[5] - m[4] * m[3]) / d;
    var yt = (-p[0] * m[1] + p[1] * m[0] + m[4] * m[1] - m[5] * m[0]) / d;
    return [xt, yt];
  };

  // Applies the transform to the rectangle and finds the minimum axially
  // aligned bounding box.
  Util.getAxialAlignedBoundingBox =
    function Util_getAxialAlignedBoundingBox(r, m) {

    var p1 = Util.applyTransform(r, m);
    var p2 = Util.applyTransform(r.slice(2, 4), m);
    var p3 = Util.applyTransform([r[0], r[3]], m);
    var p4 = Util.applyTransform([r[2], r[1]], m);
    return [
      Math.min(p1[0], p2[0], p3[0], p4[0]),
      Math.min(p1[1], p2[1], p3[1], p4[1]),
      Math.max(p1[0], p2[0], p3[0], p4[0]),
      Math.max(p1[1], p2[1], p3[1], p4[1])
    ];
  };

  Util.inverseTransform = function Util_inverseTransform(m) {
    var d = m[0] * m[3] - m[1] * m[2];
    return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d,
      (m[2] * m[5] - m[4] * m[3]) / d, (m[4] * m[1] - m[5] * m[0]) / d];
  };

  // Apply a generic 3d matrix M on a 3-vector v:
  //   | a b c |   | X |
  //   | d e f | x | Y |
  //   | g h i |   | Z |
  // M is assumed to be serialized as [a,b,c,d,e,f,g,h,i],
  // with v as [X,Y,Z]
  Util.apply3dTransform = function Util_apply3dTransform(m, v) {
    return [
      m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
      m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
      m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
    ];
  };

  // This calculation uses Singular Value Decomposition.
  // The SVD can be represented with formula A = USV. We are interested in the
  // matrix S here because it represents the scale values.
  Util.singularValueDecompose2dScale =
    function Util_singularValueDecompose2dScale(m) {

    var transpose = [m[0], m[2], m[1], m[3]];

    // Multiply matrix m with its transpose.
    var a = m[0] * transpose[0] + m[1] * transpose[2];
    var b = m[0] * transpose[1] + m[1] * transpose[3];
    var c = m[2] * transpose[0] + m[3] * transpose[2];
    var d = m[2] * transpose[1] + m[3] * transpose[3];

    // Solve the second degree polynomial to get roots.
    var first = (a + d) / 2;
    var second = Math.sqrt((a + d) * (a + d) - 4 * (a * d - c * b)) / 2;
    var sx = first + second || 1;
    var sy = first - second || 1;

    // Scale values are the square roots of the eigenvalues.
    return [Math.sqrt(sx), Math.sqrt(sy)];
  };

  // Normalize rectangle rect=[x1, y1, x2, y2] so that (x1,y1) < (x2,y2)
  // For coordinate systems whose origin lies in the bottom-left, this
  // means normalization to (BL,TR) ordering. For systems with origin in the
  // top-left, this means (TL,BR) ordering.
  Util.normalizeRect = function Util_normalizeRect(rect) {
    var r = rect.slice(0); // clone rect
    if (rect[0] > rect[2]) {
      r[0] = rect[2];
      r[2] = rect[0];
    }
    if (rect[1] > rect[3]) {
      r[1] = rect[3];
      r[3] = rect[1];
    }
    return r;
  };

  // Returns a rectangle [x1, y1, x2, y2] corresponding to the
  // intersection of rect1 and rect2. If no intersection, returns 'false'
  // The rectangle coordinates of rect1, rect2 should be [x1, y1, x2, y2]
  Util.intersect = function Util_intersect(rect1, rect2) {
    function compare(a, b) {
      return a - b;
    }

    // Order points along the axes
    var orderedX = [rect1[0], rect1[2], rect2[0], rect2[2]].sort(compare),
        orderedY = [rect1[1], rect1[3], rect2[1], rect2[3]].sort(compare),
        result = [];

    rect1 = Util.normalizeRect(rect1);
    rect2 = Util.normalizeRect(rect2);

    // X: first and second points belong to different rectangles?
    if ((orderedX[0] === rect1[0] && orderedX[1] === rect2[0]) ||
        (orderedX[0] === rect2[0] && orderedX[1] === rect1[0])) {
      // Intersection must be between second and third points
      result[0] = orderedX[1];
      result[2] = orderedX[2];
    } else {
      return false;
    }

    // Y: first and second points belong to different rectangles?
    if ((orderedY[0] === rect1[1] && orderedY[1] === rect2[1]) ||
        (orderedY[0] === rect2[1] && orderedY[1] === rect1[1])) {
      // Intersection must be between second and third points
      result[1] = orderedY[1];
      result[3] = orderedY[2];
    } else {
      return false;
    }

    return result;
  };

  Util.sign = function Util_sign(num) {
    return num < 0 ? -1 : 1;
  };

  Util.appendToArray = function Util_appendToArray(arr1, arr2) {
    Array.prototype.push.apply(arr1, arr2);
  };

  Util.prependToArray = function Util_prependToArray(arr1, arr2) {
    Array.prototype.unshift.apply(arr1, arr2);
  };

  Util.extendObj = function extendObj(obj1, obj2) {
    for (var key in obj2) {
      obj1[key] = obj2[key];
    }
  };

  Util.getInheritableProperty = function Util_getInheritableProperty(dict,
                                                                     name) {
    while (dict && !dict.has(name)) {
      dict = dict.get('Parent');
    }
    if (!dict) {
      return null;
    }
    return dict.get(name);
  };

  Util.inherit = function Util_inherit(sub, base, prototype) {
    sub.prototype = Object.create(base.prototype);
    sub.prototype.constructor = sub;
    for (var prop in prototype) {
      sub.prototype[prop] = prototype[prop];
    }
  };

  Util.loadScript = function Util_loadScript(src, callback) {
    var script = document.createElement('script');
    var loaded = false;
    script.setAttribute('src', src);
    if (callback) {
      script.onload = function() {
        if (!loaded) {
          callback();
        }
        loaded = true;
      };
    }
    document.getElementsByTagName('head')[0].appendChild(script);
  };

  return Util;
})();//}}}
PDFJS.PageViewport = (function PageViewportClosure() {//{{{
  /**
   * @constructor
   * @private
   * @param viewBox {Array} xMin, yMin, xMax and yMax coordinates.
   * @param scale {number} scale of the viewport.
   * @param rotation {number} rotations of the viewport in degrees.
   * @param offsetX {number} offset X
   * @param offsetY {number} offset Y
   * @param dontFlip {boolean} if true, axis Y will not be flipped.
   */
  function PageViewport(viewBox, scale, rotation, offsetX, offsetY, dontFlip) {
    this.viewBox = viewBox;
    this.scale = scale;
    this.rotation = rotation;
    this.offsetX = offsetX;
    this.offsetY = offsetY;

    // creating transform to convert pdf coordinate system to the normal
    // canvas like coordinates taking in account scale and rotation
    var centerX = (viewBox[2] + viewBox[0]) / 2;
    var centerY = (viewBox[3] + viewBox[1]) / 2;
    var rotateA, rotateB, rotateC, rotateD;
    rotation = rotation % 360;
    rotation = rotation < 0 ? rotation + 360 : rotation;
    switch (rotation) {
      case 180:
        rotateA = -1; rotateB = 0; rotateC = 0; rotateD = 1;
        break;
      case 90:
        rotateA = 0; rotateB = 1; rotateC = 1; rotateD = 0;
        break;
      case 270:
        rotateA = 0; rotateB = -1; rotateC = -1; rotateD = 0;
        break;
      //case 0:
      default:
        rotateA = 1; rotateB = 0; rotateC = 0; rotateD = -1;
        break;
    }

    if (dontFlip) {
      rotateC = -rotateC; rotateD = -rotateD;
    }

    var offsetCanvasX, offsetCanvasY;
    var width, height;
    if (rotateA === 0) {
      offsetCanvasX = Math.abs(centerY - viewBox[1]) * scale + offsetX;
      offsetCanvasY = Math.abs(centerX - viewBox[0]) * scale + offsetY;
      width = Math.abs(viewBox[3] - viewBox[1]) * scale;
      height = Math.abs(viewBox[2] - viewBox[0]) * scale;
    } else {
      offsetCanvasX = Math.abs(centerX - viewBox[0]) * scale + offsetX;
      offsetCanvasY = Math.abs(centerY - viewBox[1]) * scale + offsetY;
      width = Math.abs(viewBox[2] - viewBox[0]) * scale;
      height = Math.abs(viewBox[3] - viewBox[1]) * scale;
    }
    // creating transform for the following operations:
    // translate(-centerX, -centerY), rotate and flip vertically,
    // scale, and translate(offsetCanvasX, offsetCanvasY)
    this.transform = [
      rotateA * scale,
      rotateB * scale,
      rotateC * scale,
      rotateD * scale,
      offsetCanvasX - rotateA * scale * centerX - rotateC * scale * centerY,
      offsetCanvasY - rotateB * scale * centerX - rotateD * scale * centerY
    ];

    this.width = width;
    this.height = height;
    this.fontScale = scale;
  }
  PageViewport.prototype = /** @lends PDFJS.PageViewport.prototype */ {
    /**
     * Clones viewport with additional properties.
     * @param args {Object} (optional) If specified, may contain the 'scale' or
     * 'rotation' properties to override the corresponding properties in
     * the cloned viewport.
     * @returns {PDFJS.PageViewport} Cloned viewport.
     */
    clone: function PageViewPort_clone(args) {
      args = args || {};
      var scale = 'scale' in args ? args.scale : this.scale;
      var rotation = 'rotation' in args ? args.rotation : this.rotation;
      return new PageViewport(this.viewBox.slice(), scale, rotation,
                              this.offsetX, this.offsetY, args.dontFlip);
    },
    /**
     * Converts PDF point to the viewport coordinates. For examples, useful for
     * converting PDF location into canvas pixel coordinates.
     * @param x {number} X coordinate.
     * @param y {number} Y coordinate.
     * @returns {Object} Object that contains 'x' and 'y' properties of the
     * point in the viewport coordinate space.
     * @see {@link convertToPdfPoint}
     * @see {@link convertToViewportRectangle}
     */
    convertToViewportPoint: function PageViewport_convertToViewportPoint(x, y) {
      return Util.applyTransform([x, y], this.transform);
    },
    /**
     * Converts PDF rectangle to the viewport coordinates.
     * @param rect {Array} xMin, yMin, xMax and yMax coordinates.
     * @returns {Array} Contains corresponding coordinates of the rectangle
     * in the viewport coordinate space.
     * @see {@link convertToViewportPoint}
     */
    convertToViewportRectangle:
      function PageViewport_convertToViewportRectangle(rect) {
      var tl = Util.applyTransform([rect[0], rect[1]], this.transform);
      var br = Util.applyTransform([rect[2], rect[3]], this.transform);
      return [tl[0], tl[1], br[0], br[1]];
    },
    /**
     * Converts viewport coordinates to the PDF location. For examples, useful
     * for converting canvas pixel location into PDF one.
     * @param x {number} X coordinate.
     * @param y {number} Y coordinate.
     * @returns {Object} Object that contains 'x' and 'y' properties of the
     * point in the PDF coordinate space.
     * @see {@link convertToViewportPoint}
     */
    convertToPdfPoint: function PageViewport_convertToPdfPoint(x, y) {
      return Util.applyInverseTransform([x, y], this.transform);
    }
  };
  return PageViewport;
})();//}}}
