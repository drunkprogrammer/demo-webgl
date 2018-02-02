var JSGL = (function () {
    (function () {
        vec2.distanceToSegmentSq = function (p, v, w) {
            var l2 = vec2.squaredDistance(v, w);
            if (l2 == 0) {
                return vec2.squaredDistance(p, v);
            }
            var t = ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l2;
            t = Math.max(0, Math.min(1, t));
            var c = vec2.create();
            vec2.lerp(c, v, w, t);
            return vec2.squaredDistance(p, c);
        };
        vec3.getTargetPoint = function (out, viewMatrix) {
            var mat = mat4.create();
            mat4.invert(mat, viewMatrix);
            out[0] = mat[12];
            out[1] = mat[13];
            out[2] = mat[14];
            return out;
        };
        mat4.lookAtRange = function (out, aabb) {
            var yMin = aabb.min[1], yMax = aabb.max[1];
            var eye = vec3.create(), at = vec3.create(), up = vec3.fromValues(0, -1, 0);
            var midY = (yMin + yMax) / 2;
            var sizeToFit = (yMax - yMin) * 0.6;
            var distance = sizeToFit / Math.tan(Math.PI / 8);
            vec3.set(eye, 0, midY, distance);
            vec3.set(at, 0, midY, 0);
            return mat4.lookAt(out, eye, at, up);
        };
        vec4.worldToScreen = function (out, point, matrix, canvas) {
            vec4.transformMat4(out, point, matrix);
            out[0] /= out[3];
            out[1] /= out[3];
            out[0] = (out[0] * 0.5 + 0.5) * canvas.width;
            out[1] = (out[1] * -0.5 + 0.5) * canvas.height;
            return out;
        }
    })();
    var gl;
    function create(canvas, options) {
        options = options || {};

        if (!canvas) {
            var canvas = document.createElement("canvas");
            canvas.width = 800;
            canvas.height = 600;
        } 
        
        gl = canvas.getContext("webgl", options) || canvas.getContext("experimental-webgl", options);
        gl.canvas.addEventListener("webglcontextlost", contextLost, false);
        gl.canvas.addEventListener("webglcontextrestored", restoreFn, false);
        return gl;
    }

    function ControllerUtil() {
        var canvas = gl.canvas;
        var deltaOffset = {};
        var oldX, oldY, buttons = {}, has = Object.prototype.hasOwnProperty;
        var dragFn = [];
        var scrollFn = [], isWheel = "oumousewheel" in canvas, deltaObj = {};

        keys = {}, keyDownFn = [], keyUpFn = [];

        function isDragging() {
            for (var b in buttons) {
                if (has.call(buttons, b) && buttons[b]) return true;
            }
            return false;
        }

        function getPosition(target, x, y) {
            var clientPosition = target.getBoundingClientRect();
            return {
                x: x - clientPosition.left,
                y: y - clientPosition.top
            };
        }

        function mousemove(e) {
            if (isDragging()) {
                var position = getPosition(e.target, e.x, e.y);
                deltaOffset.deltaX = position.x - oldX;
                deltaOffset.deltaY = position.y - oldY;
                oldX = position.x;
                oldY = position.y;
                for (var i = 0; i < dragFn.length; i++) {
                    dragFn[i](deltaOffset);
                }
            }
        }

        function mousedown(e) {
            buttons[e.which] = true;
            var position = getPosition(e.target, e.x, e.y);
            oldX = position.x;
            oldY = position.y;
        }

        function mouseup(e) {
            buttons = {};
            deltaOffset.deltaX = 0;
            deltaOffset.deltaY = 0;
        }

        function scrollHandler(ev) {
            var detail = ev.detail / 3;
            deltaObj.detail = detail;
            for (var i = 0; i < scrollFn.length; i++) {
                scrollFn[i](detail);
            }
        }

        function wheelHandler(ev) {
            var detail = -ev.wheelDelta / 120;
            deltaObj.detail = detail;
            for (var i = 0; i < scrollFn.length; i++) {
                scrollFn[i](detail);
            }
        }

        function mapKeyCode(code) {
            var named = {
                8: 'BACKSPACE',
                9: 'TAB',
                13: 'ENTER',
                16: 'SHIFT',
                27: 'ESCAPE',
                32: 'SPACE',
                37: 'LEFT',
                38: 'UP',
                39: 'RIGHT',
                40: 'DOWN'
            };
            return named[code] || (code >= 65 && code <= 90 ? String.fromCharCode(code) : null);
        }

        function keydown(e) {
            if (!e.altKey && !e.ctrlKey && !e.metaKey) {
                var key = mapKeyCode(e.keyCode);
                if (key) keys[key] = true;
                keys[e.keyCode] = true;
                for (var i = 0; i < keyDownFn.length; i++) {
                    keyDownFn[i](keys);
                }
            }
        }

        function keyup(e) {
            if (!e.altKey && !e.ctrlKey && !e.metaKey) {
                var key = mapKeyCode(e.keyCode);
                if (key) keys[key] = false;
                keys[e.keyCode] = false;
                for (var i = 0; i < keyUpFn.length; i++) {
                    keyUpFn[i](keys);
                }
            }
        }

        return {
            drag: function (fn) {
                if (fn) {
                    var index = dragFn.indexOf(fn);
                    if (index == -1) {
                        dragFn.push(fn);
                    }
                }
                canvas.addEventListener("mousedown", mousedown, false);
                canvas.addEventListener("mousemove", mousemove, false);
                canvas.addEventListener("mouseup", mouseup, false);
                canvas.addEventListener("mouseout", mouseup, false);
                return deltaOffset;
            },
            removeDrag: function (fn) {
                if (fn) {
                    var index = dragFn.indexOf(fn);
                    if (index !== -1) {
                        dragFn.splice(index, 1);
                    }
                }
                canvas.removeEventListener("mousedown", mousedown, false);
                canvas.removeEventListener("mousemove", mousemove, false);
                canvas.removeEventListener("mouseup", mouseup, false);
                canvas.removeEventListener("mouseout", mouseup, false);
            },
            scale: function (fn) {
                if (fn) {
                    var index = scrollFn.indexOf(fn);
                    if (index == -1) {
                        scrollFn.push(fn);
                    }
                }
                if (isWheel) {
                    canvas.addEventListener("mousewheel", wheelHandler, false);
                }
                else {
                    canvas.addEventListener("DOMMouseScroll", scrollHandler, false);
                }
                return deltaObj;
            },
            removeScale: function (fn) {
                if (fn) {
                    var index = scrollFn.indexOf(fn);
                    if (index == -1) {
                        scrollFn.splice(index, 1);
                    }
                }
                if (isWheel) {
                    canvas.removeEventListener("mousewheel", wheelHandler, false);
                }
                else {
                    canvas.removeEventListener("DOMMouseScroll", scrollHandler, false);
                }
            },
            recordKey: function (downFn, upFn) {
                if (downFn && keyDownFn.indexOf(downFn) == -1) {
                    keyDownFn.push(downFn);
                }
                if (upFn && keyUpFn.indexOf(upFn) == -1) {
                    keyUpFn.push(upFn);
                }
                document.addEventListener("keydown", keydown, false);
                document.addEventListener("keyup", keyup, false);
                return keys;
            },
            removeRecordKey: function (downFn, upFn) {
                if (downFn && keyDownFn.indexOf(downFn) !== -1) {
                    var downIndex = keyDownFn.indexOf(downFn);
                    keyDownFn.splice(downIndex, 1);
                }
                if (upFn && keyUpFn.indexOf(upFn) !== -1) {
                    var upIndex = keyUpFn.indexOf(downFn);
                    keyUpFn.splice(upIndex, 1);
                }
                document.removeEventListener("keydown", keydown, false);
                document.removeEventListener("keyup", keyup, false);
            }
        }
    }

    function Program(vs, fs) {
        this.vertexShader = new Shader(gl.VERTEX_SHADER, vs);
        this.fragmentShader = new Shader(gl.FRAGMENT_SHADER, fs);
        this.createProgram();
        this.attachAttrib();
        this.attachUniform();
    }
    Program.prototype = {
        use: function () {
            gl.useProgram(this.program);
        },
        createProgram: function () {
            var vertexShader = this.vertexShader.shader;
            var fragmentShader = this.fragmentShader.shader;
            var program = gl.createProgram();
            gl.attachShader(program, vertexShader);
            gl.attachShader(program, fragmentShader);
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                throw new Error('link error: ' + gl.getProgramInfoLog(this.program));
            }
            this.program = program;
        },
        attachAttrib: function () {
            var program = this.program;
            var attribNum = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
            var that = this;
            for (var i = 0; i < attribNum; i++) {
                var attribObj = gl.getActiveAttrib(program, i);
                (function (i, attribObj) {
                    Object.defineProperty(that, attribObj.name.slice(2), {
                        get: function () {
                            return {
                                type: attribObj.type,
                                location: i,
                                dataType: "attribute"
                            }
                        },
                        set: function (buffer) {
                            var numComponent, type, normalize, stride, offset;
                            numComponent = buffer.numComponent || computedNumByAttribName(buffer, attribObj.name);
                            type = buffer.type || computedType(buffer, buffer.dataType);
                            normalize = buffer.normalize || computedNormalize(buffer, buffer.dataType);
                            stride = buffer.stride || 0;
                            offset = buffer.offset || 0;
                            gl.bindBuffer(buffer.target, buffer.buffer);
                            gl.enableVertexAttribArray(i);
                            gl.vertexAttribPointer(i, numComponent, type, normalize, stride, offset);
                            gl.bindBuffer(buffer.target, null);
                        }
                    });
                })(i, attribObj);
            }
        },
        attachUniform: function () {
            var program = this.program;
            var uniformNum = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
            var that = this;
            for (var i = 0; i < uniformNum; i++) {
                var uniformObj = gl.getActiveUniform(program, i);
                (function (i, uniformObj) {
                    var name = uniformObj.name;
                    Object.defineProperty(that, name.slice(2), {
                        get: function () {
                            return {
                                type: uniformObj.type,
                                location: gl.getUniformLocation(program, name),
                                dataType: "uniform"
                            }
                        },
                        set: function (value) {
                            var type = uniformObj.type,
                                isArray = name.indexOf("[0]") > -1 ? true : false;

                            uniformData(type, isArray)(that[name.slice(2)].location, value);
                        }
                    });
                })(i, uniformObj);
            }
        },
        updateUniform: function (obj) {
            for (var key in obj) {
                this[key] = obj[key];
            }
        },
        updateAttrib: function (primitive) {
            for (var key in primitive) {
                if (primitive.hasOwnProperty(key)) {
                    if (key !== "option" && key !== "numElements") {
                        if (key == "indices") {
                            primitive[key].bind();
                        }
                        else {
                            this[key] = primitive[key];
                        }
                    }
                }
            }
            this.primitive = primitive;
        },
        /**
         * options = {
         *      color: [0, 0, 0, 0],
         *      depth: true,
         *      cullFace: true
         * }
         */
        setEnv: function (options) {
            options = options || {};
            if (options.color) {
                gl.clearColor.apply(gl, options.color);
                if (options.depth) {
                    gl.enable(gl.DEPTH_TEST);
                    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                }
                else {
                    gl.clear(gl.COLOR_BUFFER_BIT);
                }
            } 
            if (options.cullFace) {
                gl.enable(gl.CULL_FACE);
            }
            if (options.polygon) {
                gl.enable(gl.POLYGON_OFFSET_FILL);
            }
            if (options.offset) {
                gl.polygonOffset.apply(gl, options.offset);
            }
            if (options.blend) {
                gl.enable(gl.BLEND);
                gl.blendFunc.apply(gl, options.blend);
            }
        },
        drawPrimitive: function (primitive) {
            if ("indices" in primitive) {
                var indicesBuffer = primitive.indices;
                if (primitive.option.length) {
                    primitive.option.forEach(function (method) {
                        gl.drawElements(method, indicesBuffer.numElements, indicesBuffer.type, 0);
                    });
                }
                else {
                    gl.drawElements(primitive.option, indicesBuffer.numElements, indicesBuffer.type, 0);
                }
                
            }
            else {
                if (primitive.option.length) {
                    primitive.option.forEach(function (method) {
                        gl.drawArrays(method, 0, primitive.numElements);
                    });
                }
                else {
                    gl.drawArrays(primitive.option, 0, primitive.numElements);
                }
            }
        },
        draw: function (primitive, uniformObj, options) {
            if (primitive) {
                if (primitive instanceof Mesh) {
                    primitive = primitive.compile(primitive.options);
                }

                this.setEnv(options);
                gl.useProgram(this.program);
                this.updateAttrib(primitive);
                this.updateUniform(uniformObj);
                this.drawPrimitive(primitive);
                
            }
            else {
                primitive = this.primitive;
                gl.useProgram(this.program);
                uniformObj = uniformObj || {};
                this.setEnv(options);
                this.updateUniform(uniformObj);
                this.drawPrimitive(primitive);
            }
        }
    };
    Program.fromScript = function (vsId, fsId) {
        var vsSource = document.getElementById(vsId).text.replace(/^\s+|\s+$/g, "");
        var fsSource = document.getElementById(fsId).text.replace(/^\s+|\s+$/g, "");
        return new Program(vsSource, fsSource);
    };
    Program.fromSource = function (vsSource, fsSource) {
        return new Program(vsSource, fsSource)
    };

    function Shader(type, source) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error("compile error: " + gl.getShaderInfoLog(shader));
        }
        this.shader = shader;
        this.type = type;
        this.source = source;
    }

    function Buffer(typeArray, target, usage) {
        this.target = target ? target : gl.ARRAY_BUFFER;
        this.usage = usage ? usage : gl.STATIC_DRAW;
        if (typeArray instanceof WebGLBuffer) {
            this.buffer = typeArray;
        }
        else {
            if (typeArray.BYTES_PER_ELEMENT) {
                this.dataType = typeArray.constructor;
                this.typeArray = typeArray;
                this.createBuffer();
                if (this.target === gl.ARRAY_BUFFER) {
                    this.normalize = computedNormalize(this, this.dataType);
                }
                else {
                    this.numElements = this.typeArray.length;
                }
                this.type = computedType(this, this.dataType);
            }
            else {
                this.num = typeArray;
                this.createFixedBuffer();
            }
        }
    }
    Buffer.prototype = {
        createBuffer: function () {
            var typeArray = this.typeArray,
                target = this.target, usage = this.usage;

            var buffer = gl.createBuffer();
            gl.bindBuffer(target, buffer);
            gl.bufferData(target, typeArray, usage);
            gl.bindBuffer(target, null);
            this.buffer = buffer;
        },
        createFixedBuffer: function () {
            var num = this.num,
                target = this.target, usage = this.usage;

            var buffer = gl.createBuffer();
            gl.bindBuffer(target, buffer);
            gl.bufferData(target, num, usage);
            gl.bindBuffer(target, null);
            this.buffer = buffer;
        },
        bufferData: function (data) {
            gl.bindBuffer(this.target, this.buffer);
            gl.bufferData(this.target, data, this.usage);
        },
        bufferSubData: function (data, offset) {
            var type = this.dataType;
            var num = type.BYTES_PER_ELEMENT;
            data = new type(data);
            gl.bindBuffer(this.target, this.buffer);
            gl.bufferSubData(this.target, offset * num * this.numComponent, data);
        },
        setConfig: function (numComponent, stride, offset) {
            var type = this.dataType;
            var num = type.BYTES_PER_ELEMENT;
            var buffer = new Buffer(this.buffer);
            buffer.type = this.type;
            buffer.numComponent = numComponent;
            buffer.stride = stride * num;
            buffer.offset = offset * num;
            return buffer;
        },
        setting: function (numComponent, stride, offset) {
            var type = this.dataType;
            var num = type.BYTES_PER_ELEMENT;
            numComponent = numComponent || 1;
            stride = stride || 0;
            offset = offset || 0;
            this.numComponent = numComponent;
            this.stride = stride * num;
            this.offset = offset * num;
            return this;
        },
        bind: function () {
            gl.bindBuffer(this.target, this.buffer);
        },
        setType: function (type) {
            this.dataType = type;
            this.type = computedType(this, type);
            return this;
        },
        delete: function () {
            gl.deleteBuffer(this.buffer);
        }
    };
    Buffer.fromArray = function (array, numComponent, stride, offset, type) {
        type = type || Float32Array;
        var buffer = new Buffer(new type(array));
        buffer.setting(numComponent, stride, offset);
        return buffer;
    };
    Buffer.createIndexBuffer = function (array, type) {
        type = type || Int16Array;
        return new Buffer(new type(array), gl.ELEMENT_ARRAY_BUFFER);
    };
    Buffer.createFixBuffer = function (num, numComponent, stride, offset, type) {
        type = type || Float32Array;
        var typeNum = type.BYTES_PER_ELEMENT;
        numComponent = numComponent || 2;
        stride = stride || 0;
        offset = offset || 0;
        var buffer = new Buffer(num * typeNum);
        buffer.setType(type);
        buffer.setting(numComponent, stride * typeNum, offset * typeNum);
        return buffer
    }

    function uniformData(type, isArray) {
        if (type === gl.FLOAT && isArray) {
            return function (location, v) {
                gl.uniform1fv(location, v);
            };
        }
        if (type === gl.FLOAT) {
            return function (location, v) {
                gl.uniform1f(location, v);
            };
        }
        if (type === gl.FLOAT_VEC2) {
            return function (location, v) {
                gl.uniform2fv(location, v);
            };
        }
        if (type === gl.FLOAT_VEC3) {
            return function (location, v) {
                gl.uniform3fv(location, v);
            };
        }
        if (type === gl.FLOAT_VEC4) {
            return function (location, v) {
                gl.uniform4fv(location, v);
            };
        }
        if ((type === gl.INT || type === gl.BOOL ||
            type === gl.SAMPLER_2D || type === gl.SAMPLER_CUBE) && isArray) {
            return function (location, v) {
                gl.uniform1iv(location, v);
            }
        }
        if (type === gl.INT || type === gl.BOOL ||
            type === gl.SAMPLER_2D || type === gl.SAMPLER_CUBE) {
            return function (location, v) {
                gl.uniform1i(location, v);
            };
        }
        if (type === gl.INT_VEC2 || type === gl.BOOL_VEC2) {
            return function (location, v) {
                return gl.uniform2iv(location, v);
            };
        }
        if (type === gl.INT_VEC3 || type === gl.BOOL_VEC3) {
            return function (location, v) {
                gl.uniform3iv(location, v);
            };
        }
        if (type === gl.INT_VEC4 || type === gl.BOOL_VEC4) {
            return function (location, v) {
                gl.uniform4iv(location, v);
            };
        }
        if (type === gl.FLOAT_MAT2) {
            return function (location, v) {
                gl.uniformMatrix2fv(location, false, v);
            };
        }
        if (type === gl.FLOAT_MAT3) {
            return function (location, v) {
                gl.uniformMatrix3fv(location, false, v);
            };
        }
        if (type === gl.FLOAT_MAT4) {
            return function (location, v) {
                gl.uniformMatrix4fv(location, false, v);
            };
        }
    }

    var framebuffer, renderbuffer;
    function Texture(type, textureOptions, images) {
        this.textureOptions = textureOptions;
        this.type = type;
        if (type == gl.TEXTURE_2D) {
            if (!images) {
                this.image = null;
            }
            else {
                if (Array.isArray(images)) {
                    this.image = images[0];
                }
                else {
                    this.image = images;
                }
            }
        }
        else if (type == gl.TEXTURE_CUBE_MAP) {
            this.image = images;
        }
        this.createTexture();
        this.bind(textureOptions.target);
        this.configTexture();
    }
    Texture.prototype = {
        createTexture: function () {
            var texture = gl.createTexture();
            this.texture = texture;
        },
        bind: function (i) {
            gl.activeTexture(gl.TEXTURE0 + (i | this.textureOptions.target));
            gl.bindTexture(this.type, this.texture);
        },
        unbind: function (i) {
            gl.activeTexture(gl.TEXTURE0 + (i | this.textureOptions.target));
            gl.bindTexture(this.type, null);
        },
        configTexture: function () {
            var textureOptions = this.textureOptions;
            var type = this.type;
            image = this.image;
            var imageFormat = textureOptions.format;
            var imageType = textureOptions.type;
            var imageInternalFormat = textureOptions.internalFormat;
            textureOptions.configTexture();

            gl.texParameteri(type, gl.TEXTURE_MAG_FILTER, textureOptions.magFilter);
            gl.texParameteri(type, gl.TEXTURE_MIN_FILTER, textureOptions.minFilter);
            gl.texParameteri(type, gl.TEXTURE_WRAP_T, textureOptions.wrapT);
            gl.texParameteri(type, gl.TEXTURE_WRAP_S, textureOptions.wrapS);

            if (type == gl.TEXTURE_2D) {
                if (!this.image || this.image.BYTES_PER_ELEMENT) {
                    gl.texImage2D(type, 0, imageFormat, textureOptions.width, textureOptions.height, 0,
                        imageInternalFormat, imageType, this.image);
                }
                else {
                    gl.texImage2D(type, 0, imageFormat, imageInternalFormat, imageType, this.image);
                }
            }
            else if (type == gl.TEXTURE_CUBE_MAP) {
                if (image[0].BYTES_PER_ELEMENT) {
                    var width = textureOptions.width, height = textureOptions.height;
                    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, imageFormat, width, height, 0, imageInternalFormat, imageType, image[0]);
                    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, imageFormat, width, height, 0, imageInternalFormat, imageType, image[1]);
                    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, imageFormat, width, height, 0, imageInternalFormat, imageType, image[2]);
                    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, imageFormat, width, height, 0, imageInternalFormat, imageType, image[3]);
                    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, imageFormat, width, height, 0, imageInternalFormat, imageType, image[4]);
                    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, imageFormat, width, height, 0, imageInternalFormat, imageType, image[5]);
                }
                else {
                    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, imageFormat, imageInternalFormat, imageType, image[0]);
                    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, imageFormat, imageInternalFormat, imageType, image[1]);
                    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, imageFormat, imageInternalFormat, imageType, image[2]);
                    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, imageFormat, imageInternalFormat, imageType, image[3]);
                    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, imageFormat, imageInternalFormat, imageType, image[4]);
                    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, imageFormat, imageInternalFormat, imageType, image[5]);
                } 
            }

            if (isPower2(textureOptions.width) && isPower2(textureOptions.height)) {
                if (textureOptions.minFilter == 9987 ||
                    textureOptions.minFilter == 9986 ||
                    textureOptions.minFilter == 9985 ||
                    textureOptions.minFilter == 9984) {
                    gl.generateMipmap(type);
                }
            }
        },
        drawTo: function (callback) {
            var v = gl.getParameter(gl.VIEWPORT);
            framebuffer = framebuffer || gl.createFramebuffer();
            renderbuffer = renderbuffer || gl.createRenderbuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
            var textureOptions = this.textureOptions;
            if (textureOptions.width != renderbuffer.width || textureOptions.height != renderbuffer.height) {
                renderbuffer.width = textureOptions.width;
                renderbuffer.height = textureOptions.height;
                gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
                gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16,
                    textureOptions.width, textureOptions.height);

                gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);
            }
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
            if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) {
                throw new Error('Rendering to this texture is not supported (incomplete framebuffer)');
            }
            gl.viewport(0, 0, textureOptions.width, textureOptions.height);

            callback();

            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.bindRenderbuffer(gl.RENDERBUFFER, null);
            gl.viewport(v[0], v[1], v[2], v[3]);
        },
        updateImage: function (image) {
            this.image = image;
            textureOptions = this.textureOptions;
            this.bind();
            if (this.type == gl.TEXTURE_2D) {
                gl.texImage2D(this.type, 0, textureOptions.format, textureOptions.internalFormat,
                    textureOptions.type, image);
            }
            else {
                throw new Error("error : update Image" + this.type);
            }
        },
        bindFramebuffer: function () {
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
        }
    }

    function TextureOptions(width, height, options) {
        options = options || {};
        this.options = options;
        this.width = width;
        this.height = height;
        this.format = options.format || gl.RGBA;
        this.internalFormat = options.internalFormat || options.format || gl.RGBA;
        this.type = options.type || gl.UNSIGNED_BYTE;
        this.magFilter = options.magFilter || gl.LINEAR;
        this.computedMinFilter();
        this.wrapS = options.wrapS || gl.CLAMP_TO_EDGE;
        this.wrapT = options.wrapT || gl.CLAMP_TO_EDGE;
        this.target = options.target || 0;
    }
    TextureOptions.prototype = {
        configTexture: function () {
            var options = this.options;
            if (options.alignment !== undefined) {
                gl.pixelStorei(gl.UNPACK_ALIGNMENT, options.alignment);
            }
            if (options.alpha) {
                gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
            }
        },
        computedMinFilter: function () {
            var options = this.options;
            if (options.minFilter) {
                this.minFilter = options.minFilter;
            }
            else {
                if (isPower2(this.width) && isPower2(this.height)) {
                    this.minFilter = gl.LINEAR_MIPMAP_LINEAR;
                }
                else {
                    this.minFilter = gl.LINEAR;
                }
            }
        }
    };

    Texture.fromImage = function (image, options) {
        options = options || {};
        var textureOptions = new TextureOptions(image.width, image.height, options);
        if (!options.flipY) {
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        }
        var texture = new Texture(gl.TEXTURE_2D, textureOptions, image);
        return texture;
    };

    Texture.fromURL = function (url, options, backFn) {
        options = options || {};
        var image = new Image();
        var texture = Texture.fromDigitalData(new Uint8Array([
            255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255
        ]), 2, 3, options);
        image.onload = function () {
            texture.textureOptions.width = image.width;
            texture.textureOptions.height = image.height;
            if (!options.flipY) {
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            }
            texture.updateImage(image);
            if (!options.minFilter && isPower2(image.width) && isPower2(image.height)) {
                gl.generateMipmap(gl.TEXTURE_2D);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            }
            backFn && backFn(texture, image);
        };
        if (/(http|https):/.test(url)) {
            requestCORSIfNotSameOrigin(image, url);
        }
        
        image.src = url;
        return texture;
    };

    Texture.createEmptyTexture = function (width, height, options) {
        var textureOptions = new TextureOptions(width, height, options);
        var texture = new Texture(gl.TEXTURE_2D, textureOptions);
        return texture;
    };

    Texture.fromDigitalData = function (data, width, height, option) {
        var textureOptions = new TextureOptions(width, height, option);
        var texture = new Texture(gl.TEXTURE_2D, textureOptions, data);
        return texture;
    };

    Texture.fromAutoData = function (data) {
        var width = data.length - 1, height = data[0].length - 1;
        var normalst = [];
        for (var i = 0; i < width; i++) {
            normalst[i] = [];
            for (var j = 0; j < height; j++) {
                normalst[i][j] = [];
                normalst[i][j][0] = data[i][j] - data[i + 1][j];
                normalst[i][j][1] = data[i][j] - data[i][j + 1];
                normalst[i][j][2] = 1;
            }
        }
        for (var i = 0; i < width; i++) {
            for (var j = 0; j < height; j++) {
                var d = 0;
                for (k = 0; k < 3; k++) {
                    d += normalst[i][j][k] * normalst[i][j][k];
                }
                d = Math.sqrt(d);
                for (k = 0; k < 3; k++) {
                    normalst[i][j][k] = 0.5 * normalst[i][j][k] / d + 0.5;
                }
            }
        }

        var normals = new Uint8Array(3 * width * height);
        for (var i = 0; i < width; i++) {
            for (var j = 0; j < height; j++) {
                for (var k = 0; k < 3; k++) {
                    normals[3 * height * i + 3 * j + k] = 255 * normalst[i][j][k];
                }
            }
        }

        return Texture.fromDigitalData(normals, width, height, {format: gl.RGB});
    };

    Texture.createCubeMap = function (images, width, height, option) {
        width = width || images[0].width;
        height = height || images[0].height;
        var textureOptions = new TextureOptions(width, height, option);
        var texture = new Texture(gl.TEXTURE_CUBE_MAP, textureOptions, images);
        return texture;
    }

    var ctx = document.createElement("canvas").getContext("2d");
    var setCanvasSize = function(width, height) {
        ctx.canvas.width  = width;
        ctx.canvas.height = height;
    };
    Texture.makeStripeTexture = function (width, height, color1, color2, option) {
        width = width || 2;
        height = height || 2;
        color1 = color1 || "white";
        color2 = color2 || "black";
        setCanvasSize(width, height);
        ctx.fillStyle = color1;
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = color2;
        ctx.fillRect(0, 0, width, height / 2);

        return Texture.fromImage(ctx.canvas, option);
    };
    Texture.makeCheckerTexture = function (width, height, color1, color2, option) {
        width = width || 2;
        height = height || 2;
        color1 = color1 || "white";
        color2 = color2 || "black";
        setCanvasSize(width, height);
        ctx.fillStyle = color1;
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = color2;
        ctx.fillRect(0, 0, width / 2, height / 2);
        ctx.fillRect(width / 2, height / 2, width / 2, height / 2);
        return Texture.fromImage(ctx.canvas, option);
    };
    Texture.makeCircleTexture = function (width, height, color1, color2, option) {
        width = width || 128;
        height = height || 128;
        color1 = color1 || "white";
        color2 = color2 || "black";
        setCanvasSize(width, height);
        var size = Math.min(width, height);
        ctx.fillStyle = color1;
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = color2;
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.beginPath();
        ctx.arc(0, 0, width / 2 - 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = color1;
        ctx.beginPath();
        ctx.arc(0, 0, width / 4 - 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return Texture.fromImage(ctx.canvas, option);
    };
    Texture.makeRandomTexture = function (width, height, min, max) {
        width = width || 2;
        height = height || 2;
        min = min || 0;
        max = max || 256;

        var numPixels = width * height;
        var pixels = new Uint8Array(numPixels * 4);
        var strong = 4;
        for (var p = 0; p < numPixels; p++) {
            var off = 4 * p;
            pixels[off + 0] = randomInt(min, max);
            pixels[off + 1] = randomInt(min, max);
            pixels[off + 2] = randomInt(min, max);
            pixels[off + 3] = 255;
        }

        return Texture.fromDigitalData(pixels, width, height, {});
    };  

    function Mesh(option) {
        this.option = option || [];
        this.position = [];
    }
    Mesh.prototype = {
        transform: function (matrix) {
            var p = this.position;
            var tp = vec3.create();
            for (var i = 0, len = p.length; i < len; i += 3) {
                vec3.transformMat4(tp, [p[i], p[i + 1], p[i + 2]], matrix);
                this.position[i] = tp[0];
                this.position[i + 1] = tp[1];
                this.position[i + 2] = tp[2];
            }
            if (this.normal) {
                var inverMatrix = mat3.create();
                mat3.normalFromMat4(inverMatrix, matrix);
                var n = this.normal, newN = [], tn = vec3.create();
                for (var j = 0, len = n.length; j < len; j += 3) {
                    vec3.transformMat4(tn, [n[i], n[i + 1], n[i + 2]], inverMatrix);
                    this.normal[i] = tn[0];
                    this.normal[i + 1] = tn[1];
                    this.normal[i + 2] = tn[2];
                }
            }
        },
        setRandomColor: function () {
            var p = this.position;
            var len = p.length;
            var color = [];
            for (var i = 0; i < len; i += 3) {
                var random = Color.random();
                color.push(random.r, random.g, random.g, random.a);
            }
            this.color = color;
            return this;
        },
        computeNormals: function (indices) {
            var p = this.position;
            var i = indices || this.indices;
            var n = [];
            for (var ii = 0, len = i.length; ii < len; ii += 3) {
                var p1 = [p[i[ii + 0] * 3], p[i[ii + 0] * 3 + 1], p[i[ii + 0] * 3 + 2]];
                var p2 = [p[i[ii + 1] * 3], p[i[ii + 1] * 3 + 1], p[i[ii + 1] * 3 + 2]];
                var p3 = [p[i[ii + 2] * 3], p[i[ii + 2] * 3 + 1], p[i[ii + 2] * 3 + 2]];
                var n1 = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];
                var n2 = [p3[0] - p1[0], p3[1] - p1[1], p3[2] - p1[2]];
                var normal = [
                    n1[1] * n2[2] - n1[2] * n2[1],
                    n1[2] * n2[0] - n1[0] * n2[2],
                    n1[0] * n2[1] - n1[1] * n2[0]
                ];
                var normalLength = Math.sqrt(normal[0] * normal[0], normal[1] * normal[1], normal[2] * normal[2]);
                var nn = [normal[0] / normalLength, normal[1] / normalLength, normal[2] / normalLength];
                n = n.concat(nn);
            }
            this.normal = n;
        },
        getAABB: function () {
            var aabb = {
                min: [Infinity, Infinity, Infinity], 
                max: [-Infinity, -Infinity, -Infinity]
            };
            var p = this.position;
            for (var i = 0, len = p.length; i < len; i += 3) {
                var v = [p[i], p[i + 1], p[i + 2]];
                aabb.min[0] = Math.min(aabb.min[0], v[0]);
                aabb.min[1] = Math.min(aabb.min[1], v[1]);
                aabb.min[2] = Math.min(aabb.min[2], v[2]);
                aabb.max[0] = Math.max(aabb.max[0], v[0]);
                aabb.max[1] = Math.max(aabb.max[1], v[1]);
                aabb.max[2] = Math.max(aabb.max[2], v[2]);
            }
            return aabb;
        },
        getBoundingSphere: function () {
            var aabb = this.getAABB();
            var sphere = { center: [
                (aabb.min[0] + aabb.max[0]) / 2,
                (aabb.min[1] + aabb.max[1]) / 2,
                (aabb.min[2] + aabb.max[2]) / 2,
            ], radius: 0 };
            var p = this.position;
            for (var i = 0, len = p.length; i < len; i += 3) {
                var tempP = [p[i], p[i + 1], p[i + 2]];
                var length = Math.sqrt(
                    Math.pow(tempP[0] - sphere.center[0], 2) +
                    Math.pow(tempP[1] - sphere.center[1], 2) +
                    Math.pow(tempP[2] - sphere.center[2], 2)
                );
                sphere.radius = Math.max(sphere.radius, length);
            }
            return sphere;
        },
        compile: function (options) {
            options = options || {};
            var primitive = new Primitive(this, this.option);
            primitive.compile(options);
            
            return primitive;
        }
        // 补充每个面不同的颜色设置
        
    };

    function Primitive(mesh, option) {
        this.mesh = mesh;
        this.option = option;
    }
    Primitive.prototype = {
        compile: function (options) {
            var mesh = this.mesh, option = this.option;
            var positionBuffer = new Buffer(new Float32Array(mesh.position));
            this.position = positionBuffer.setting.apply(positionBuffer, options.position || [3, 0, 0]);
            if (mesh.normal) {
                var normalBuffer = new Buffer(new Float32Array(mesh.normal));
                this.normal = normalBuffer.setting.apply(normalBuffer, options.normal || [3, 0, 0]);
            }
            if (mesh.texcoord) {
                var texcoordBuffer = new Buffer(new Float32Array(mesh.texcoord));
                this.texcoord = texcoordBuffer.setting.apply(texcoordBuffer, options.texcoord || [2, 0, 0]);
            }
            if (mesh.color) {
                var colorBuffer;
                if (options.colorType) {
                    colorBuffer = new Buffer(new options.colorType(mesh.color));
                }
                else if (mesh.color[3] > 0 && mesh.color[3] <= 1) {
                    colorBuffer = new Buffer(new Float32Array(mesh.color));
                }
                else {
                    colorBuffer = new Buffer(new Uint8Array(mesh.color));
                }
                this.color = colorBuffer.setting.apply(colorBuffer, options.color || [4, 0, 0]);
            }
            if (mesh.indices) this.indices = new Buffer(new Uint16Array(mesh.indices), gl.ELEMENT_ARRAY_BUFFER);
            else this.numElements = mesh.position.length / (options.position ? options.position[0] : 3);
        },
        update: function (obj, numObj) {
            for (var key in obj) {
                this[key].bufferData(obj[key]);
            }
            this.numElements = numObj.numElements;
        }
    }
    Primitive.createEmptyPrimitive = function (options, method) {
        var obj = {};
        for (var key in options) {
            obj[key] = [];
        };
        var mesh = Mesh.fromObj(obj, method, null, options);
        return mesh.compile(options);
    }
    /**
     * 
     * options 代表各参数对应的指数
     * { position: [3, 0, 0] }
     */
    Mesh.fromObj = function (obj, option, transform, options) {
        options = options || {};
        var mesh = new Mesh(option);
        for (var key in obj) {
            mesh[key] = obj[key];
        }
        transform && mesh.transform(transform);
        mesh.options = options;

        return mesh;
    }
    Mesh.truncatedCone = function (bottomRadius, topRadius, height, divides, option, transform) {
        bottomRadius = bottomRadius || 0.8;
        topRadius = topRadius || 0.0;
        height = height || 1.6;
        divides = divides || 12;
        option = option || [gl.TRIANGLES];

        var positions = [], indices = [], texcoords = [], normals = [];
        for (var i = 0; i < divides; i++) {
            var stepAngle = 1 / divides * Math.PI * 2, 
                currentAngle = i * 2 * Math.PI / divides,
                nextAngle = currentAngle + stepAngle;

            var bp1 = [Math.cos(currentAngle) * bottomRadius, -height / 2, Math.sin(currentAngle) * bottomRadius];
            var bp2 = [Math.cos(nextAngle) * bottomRadius, -height / 2, Math.sin(nextAngle) * bottomRadius];
            var bc = [0, -height / 2, 0];
            var tp1 = [Math.cos(currentAngle) * topRadius, height / 2, Math.sin(currentAngle) * topRadius];
            var tp2 = [Math.cos(nextAngle) * topRadius, height / 2, Math.sin(nextAngle) * topRadius];
            var tc = [0, height / 2, 0];
            positions = positions.concat(
                bp1, bp2, tp2,
                tp2, tp1, bp1,
                bc,  bp2, bp1,
                tc,  tp1, tp2
            );
            
            var np1 = getNormals(bp1, tp1, currentAngle);
            var np2 = getNormals(bp2, tp2, nextAngle);
            normals = normals.concat(
                np1, np2, np2,
                np2, np1, np1,
                [0, 0, -1],[0, 0, -1],[0, 0, -1],
                [0, 0, 1], [0, 0, 1],[0, 0, 1]
            )
            texcoords.push(
                i / divides, 0, (i + 1) / divides, 0, (i + 1) / divides, 1,
                (i + 1) / divides, 1, i / divides, 1, i / divides, 0,
                i / divides, 0, i / divides, 0, i / divides, 0,
                i / divides, 0, i / divides, 0, i / divides, 0
            )
        }
        for (var i = 0, len = positions.length / 3; i < len; i++) {
            indices.push(i);
        }

        var mesh = new Mesh(option);
        mesh.position = positions;
        mesh.indices = indices;
        mesh.texcoord = texcoords;
        mesh.normal = normals;
        transform && mesh.transform(transform);

        return mesh;
    };
    function getNormals(bp1, tp1, angle) {
        var n1 = [bp1[0] - tp1[0], bp1[1] - tp1[1], bp1[2] - tp1[2]];
        var n2 = [Math.cos(angle), 0, Math.sin(angle)];
        var p1 = cross(n1, n2);
        return cross(p1, n1);
    }
    function cross(n, p) {
        var c = [
            n[1] * p[2] - n[2] * p[1],
            n[2] * p[0] - n[0] * p[2],
            n[0] * p[1] - n[1] * p[0]
        ];
        var d = Math.sqrt(c[0] * c[0] + c[1] * c[1] + c[2] * c[2]);
        return [c[0]/d, c[1]/d, c[2]/d];
    }
    Mesh.plane = function (width, height, detailX, detailY, option, transform) {
        width = width || 1;
        height = height || 1;
        detailX = detailX || 1;
        detailY = detailY || 1;
        option = option || [ gl.TRIANGLES, gl.LINE_LOOP ];
        var mesh = new Mesh(option);
        var position = [], texcoord = [], normals = [], indices = [];
        for (var y = 0; y <= detailY; y++) {
            var t = y / detailY;
            for (var x = 0; x <= detailX; x++) {
                var s = x / detailX;
                position.push((2 * s - 1) * width, (2 * t - 1) * height, 0);
                texcoord.push(s, 1 - t);
                normals.push(0, 0, 1);

                if (x < detailX && y < detailY) {
                    var i = x + y * (detailX + 1);
                    indices.push(i, i + 1, i + detailX + 1, i + detailX + 1, i + 1, i + detailX + 2);
                }
            }
        }
        mesh.position = position;
        mesh.texcoord = texcoord;
        mesh.normal = normals;
        mesh.indices = indices;
        transform && mesh.transform(transform);

        return mesh;
    };
    var cubeData = [
        [0, 4, 2, 6, -1, 0, 0],
        [1, 3, 5, 7, +1, 0, 0],
        [0, 1, 4, 5, 0, -1, 0],
        [2, 6, 3, 7, 0, +1, 0],
        [0, 2, 1, 3, 0, 0, -1],
        [4, 5, 6, 7, 0, 0, +1] 
    ];
    Mesh.cube = function (width, height, depth, option, transform) {
        width = width || 1;
        height = height || 1;
        depth = depth || 1;
        option = option || [gl.TRIANGLES, gl.LINE_LOOP];
        
        var mesh = new Mesh(option);
        var position = [], normal = [], texcoord = [], indices = [];
        for (var i = 0; i < cubeData.length; i++) {
            var data = cubeData[i], v = i * 4;
            for (var j = 0; j < 4; j++) {
                var d = data[j];
                var p = pickOctant(d)
                position.push(p[0] * width, p[1] * height, p[2] * depth);
                normal = normal.concat(data.slice(4, 7));
                texcoord.push(j & 1, (j & 2 ) / 2);
            }
            indices.push(v, v + 1, v + 2, v + 2, v + 1, v + 3);
        }

        mesh.position = position;
        mesh.texcoord = texcoord;
        mesh.normal = normal;
        mesh.indices = indices;
        transform && mesh.transform(transform);

        return mesh;
    };
    Mesh.sphere = function (center, radius, detail, option, transform) {
        center = center || [0, 0, 0];
        radius = radius || 1;
        detail = detail || 6;
        function tri(a, b, c) { return flip ? [a, c, b] : [a, b, c]; }
        function fix(x) { return x + (x - x * x) / 2; }
        option = option || [gl.TRIANGLES, gl.LINE_LOOP];

        var mesh = new Mesh(option);
        var indexer = new Indexer();

        var position = [], normal = [], texcoord = [], indices = [];
        for (var octant = 0; octant < 8; octant++) {
            var scale = pickOctant(octant);
            var flip = scale[0] * scale[1] * scale[2] > 0;
            var data = [];
            for (var i = 0; i <= detail; i++) {
                for (var j = 0; i + j <= detail; j++) {
                    var a = i / detail;
                    var b = j / detail;
                    var c = (detail - i - j) / detail;
                    var v = [fix(a), fix(b), fix(c)];
                    var vlen = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
                    var vNormalize = [v[0] / vlen, v[1] / vlen, v[2] / vlen];
                    var n = [vNormalize[0] * scale[0], vNormalize[1] * scale[1], vNormalize[2] * scale[2]];
                    var vertex = { vertex: n };
                    vertex.coord = scale.y > 0 ? [1 - a, c] : [c, 1 - a];
                    data.push(indexer.add(vertex));
                }
                if (i > 0) {
                    for (var j = 0; i + j <= detail; j++) {
                        var a = (i - 1) * (detail + 1) + ((i - 1) - (i - 1) * (i - 1)) / 2 + j;
                        var b = i * (detail + 1) + (i - i * i) / 2 + j;
                        indices = indices.concat(tri(data[a], data[a + 1], data[b]));
                        if (i + j < detail) {
                            indices = indices.concat(tri(data[b], data[a + 1], data[b + 1]))
                        }
                    }
                }
            }
        }

        indexer.unique.forEach(function (v) {
            var vertex = v.vertex;
            normal.push(vertex[0], vertex[1], vertex[2]);
            position.push(
                vertex[0] * radius + center[0], 
                vertex[1] * radius + center[1], 
                vertex[2] * radius + center[2]
            );
            texcoord = texcoord.concat(v.coord);
        });
        mesh.position = position;
        mesh.texcoord = texcoord;
        mesh.normal = normal;
        mesh.indices = indices;
        transform && mesh.transform(transform);

        return mesh;
    };
    Mesh.Context3D = function (position, option) {
        this.position = position || [];
        this.option = option || gl.LINE_STRIP;
    }
    Mesh.Context3D.prototype = new Mesh();
    Mesh.Context3D.prototype.lineTo = function (v) {
        this.position.push(v[0], v[1], v[2]);
        return this;
    };
    Mesh.Context3D.prototype.curveTo = function (v1, v2, v3, matrix) {
        var v0 = this.position.slice(-3);
        if (v0.length === 0) return new Error("start point is losing");
        if (matrix) {
            v0 = matrix.transformPoint(v0[0], v0[1], v0[2]);
            v1 = matrix.transformPoint(v1[0], v1[1], v1[2]);
            v2 = matrix.transformPoint(v2[0], v2[1], v2[2]);
            v3 = matrix.transformPoint(v3[0], v3[1], v3[2]);
        }

        var points = getBezierPoints(v0, v1, v2, v3);
        this.position = this.position.concat(points);
        return this;

        function getBezierPoints(v0, v1, v2, v3) {
            var l0 = v0, 
                l1 = [(v0[0] + v1[0]) / 2, (v0[1] + v1[1]) / 2, (v0[2] + v1[2]) / 2],
                l2 = [
                    (l1[0] + (v1[0] + v2[0]) / 2) / 2, 
                    (l1[1] + (v1[1] + v2[1]) / 2) / 2, 
                    (l1[2] + (v1[2] + v2[2]) / 2) / 2],

                r3 = v3, 
                r2 = [(v2[0] + v3[0]) / 2, (v2[1] + v3[1]) / 2, (v2[2] + v3[2]) / 2],
                r1 = [
                    (r2[0] + (v1[0] + v2[0]) / 2) / 2, 
                    (r2[1] + (v1[1] + v2[1]) / 2) / 2,
                    (r2[2] + (v1[2] + v2[2]) / 2) / 2],
                r0 = l3 = [(l2[0] + r1[0]) / 2, (l2[1] + r1[1]) / 2, (l2[2] + r1[2]) / 2];

            if (checkParallel(l0, l3, l1, l2) && checkParallel(r0, r3, r1, r2)) {
                return r0.concat(r3);
            }
            else if (checkParallel(l0, l3, l1, l2)) {
                return r0.concat(getBezierPoints(r0, r1, r2, r3));
            }
            else if (checkParallel(r0, r3, r1, r2)) {
                return getBezierPoints(l0, l1, l2, l3).concat(r3);
            }
            else {
                return getBezierPoints(l0, l1, l2, l3).concat(getBezierPoints(r0, r1, r2, r3));
            }
        }

        function checkParallel(v1, v2, v3, v4) {
            var lineLine = Math.sqrt(Math.pow(v2[0] - v1[0], 2)
                 + Math.pow(v2[1] - v1[1], 2) + Math.pow(v2[2] - v1[2], 2));
            if (lineLine * gl.canvas.width < 4) return true;

            var vn1 = [v1[0] - v2[0], v1[1] - v2[1], v1[2] - v2[2]];
            var vn1Length = Math.sqrt(vn1[0] * vn1[0] + vn1[1] * vn1[1] + vn1[2] * vn1[2]);
            var vn1n = [vn1[0] / vn1Length, vn1[1] / vn1Length, vn1[2] / vn1Length];

            var vn2 = [v3[0] - v4[0], v3[1] - v4[1], v3[2] - v4[2]];
            var vn2Length = Math.sqrt(vn2[0] * vn2[0] + vn2[1] * vn2[1] + vn2[2] * vn2[2]);
            var vn2n = [vn2[0] / vn2Length, vn2[1] / vn2Length, vn2[2] / vn2Length];

            var cs = Math.abs(vn1n[0] * vn2n[0] + vn1n[1] * vn2n[1] + vn1n[2] * vn2n[2] - 1);

            var m1 = [(v1[0] + v2[0]) / 2, (v1[1] + v2[1]) / 2, (v1[2] + v2[2]) / 2];
            var m2 = [(v3[0] + v4[0]) / 2, (v3[1] + v4[1]) / 2, (v3[2] + v4[2]) / 2];
            var mlen = Math.sqrt(
                Math.pow(m1[0] - m2[0], 2) +
                Math.pow(m1[1] - m2[1], 2) +
                Math.pow(m1[2] - m2[2], 2)
            );

            return cs < 0.01 && mlen * gl.canvas.width < 4;
        }
    };
    Mesh.Context3D.prototype.fromFunc = function (fn, start, end, num) {
        start = start || 0;
        end = end || 1;
        num = num || 10;
        var points = [], step = (end - start) / num, env = { step: 0, max: num };
        while (start < end) {
            points = points.concat(fn.call(env, start));
            env.step++;
            start += step;
        }

        points = points.concat(fn.call(env, end));
        this.position = this.position.concat(points);
        return this;
    };

    Mesh.figure = function (vfn, nfn, pmin, pmax, pn, tmin, tmax, tn, option, transform) {
        pmin = pmin || 0;
        pmax = pmax || 1;
        pn = pn || 10;
        tmin = tmin || 0;
        tmax = tmax || 1;
        tn = tn || 10;
        option = option || [gl.TRIANGLES, gl.LINE_LOOP];
        var mesh = new Mesh(option);

        var position = [], indices = [], normal = [], texcoord = [];
        var pstep = (pmax - pmin) / pn;
        var tstep = (tmax - tmin) / tn;
        for (var i = 0; i <= pn; i++) {
            var p = pmin + pstep * i;
            for (var j = 0; j <= tn; j++) {
                var t = tmin + tstep * j;
                position = position.concat(vfn(p, t));
                normal = normal.concat(normalize(nfn(p, t)));
                texcoord.push((p - pmin) / (pmax - pmin), (t - tmin) / (tmax - tmin));
            }
        }

        for (var j = 0; j < pn; j++) {
            for (var i = 0; i < tn; i++) {
                p1 = j * (tn + 1) + i;
                p2 = p1 + (tn + 1);
                indices.push(p1, p2, p1 + 1, p1 + 1, p2, p2 + 1);
            }
        }
        mesh.position = position;
        mesh.indices = indices;
        mesh.normal = normal;
        mesh.texcoord = texcoord;
        transform && mesh.transform(transform);

        return mesh;
    };

    Mesh.ring = function (bRadius, cRadius, bStep, cStep, option, transform) {
        bRadius = bRadius || 0.8;
        cRadius = cRadius || 0.2;
        bStep = bStep || 20;
        cStep = cStep || 10;
        option = option || [gl.TRIANGLES];
        var mesh = new Mesh(option);

        var position = [], normal = [], indices = [], texcoord = [];
        for (var i = 0; i < bStep; i++) {
            var angle = i * Math.PI * 2 / bStep, nextAngle = angle + Math.PI * 2 / bStep;
            var cCosAngle = Math.cos(angle), cSinAngle = Math.sin(angle),
                cCosNextAngle = Math.cos(nextAngle), cSinNextAngle = Math.sin(nextAngle);
            var arcP1 = [bRadius * cCosAngle, 0, bRadius * cSinAngle],
                arcP2 = [bRadius * cCosNextAngle, 0, bRadius * cSinNextAngle];

            for (var j = 0; j < cStep; j++) {
                var s = i / bStep, t = j / cStep, sStep = 1 / bStep, tStep = 1 / cStep; 
                var cAngle = j * Math.PI * 2 / cStep, cNextAngle = cAngle + Math.PI * 2 / cStep;
                var cd1 = (1 - Math.cos(cAngle)) * cRadius, cd2 = (1 - Math.cos(cNextAngle)) * cRadius;
                var tempRadius1 = cRadius + bRadius - cd1, tempRadius2 = cRadius + bRadius - cd2;

                var maxArcP1 = [tempRadius1 * cCosAngle, cRadius * Math.sin(cAngle), tempRadius1 * cSinAngle];
                var maxArcP2 = [tempRadius1 * cCosNextAngle, cRadius * Math.sin(cAngle), tempRadius1 * cSinNextAngle];
                var minArcP1 = [tempRadius2 * cCosAngle, cRadius * Math.sin(cNextAngle), tempRadius2 * cSinAngle];
                var minArcP2 = [tempRadius2 * cCosNextAngle, cRadius * Math.sin(cNextAngle), tempRadius2 * cSinNextAngle];

                position = position.concat(maxArcP1, maxArcP2, minArcP2, minArcP1);
                normal = normal.concat(
                    normalize([maxArcP1[0] - arcP1[0], maxArcP1[1] - arcP1[1], maxArcP1[2] - arcP1[2]]), 
                    normalize([maxArcP2[0] - arcP2[0], maxArcP2[1] - arcP2[1], maxArcP2[2] - arcP2[2]]), 
                    normalize([minArcP2[0] - arcP2[0], minArcP2[1] - arcP2[1], minArcP2[2] - arcP2[2]]), 
                    normalize([minArcP1[0] - arcP1[0], minArcP1[1] - arcP1[1], minArcP1[2] - arcP1[2]])
                );
                texcoord.push(s, t, s + sStep, t, s + sStep, t + tStep, s, t + tStep);
            }
        }

        for (var i = 0, len = position.length; i < len; i += 12) {
            indices.push(i / 3, i / 3 + 1, i / 3 + 2, i / 3 + 2, i / 3 + 3, i / 3);
        }

        mesh.position = position;
        mesh.normal = normal;
        mesh.indices = indices;
        mesh.texcoord = texcoord;
        transform && mesh.transform(transform);

        return mesh;
    };
    Mesh.cylinda = function (innerRadius, outerRadius, height, step, option, transform) {
        innerRadius = innerRadius || 0;
        outerRadius = outerRadius || 1;
        height = height || 4;
        step = step || 24;
        option = option || [gl.LINE_STRIP];
        var mesh = new Mesh(option);

        var position = [], normal = [], indices = [], texcoord = [];
        for (var i = 0; i < step; i++) {
            var s = i / step, sStep = 1 / step;
            var angle = i * Math.PI * 2 / step, nextAngle = angle + Math.PI * 2 / step;
            var po1 = [outerRadius * Math.cos(angle),-height / 2, outerRadius * Math.sin(angle)];
            var po2 = [outerRadius * Math.cos(nextAngle), -height / 2, outerRadius * Math.sin(nextAngle)];
            var po3 = [outerRadius * Math.cos(nextAngle), height / 2, outerRadius * Math.sin(nextAngle)];
            var po4 = [outerRadius * Math.cos(angle), height / 2, outerRadius * Math.sin(angle)];
            position = position.concat(po1, po2, po3, po4);
            normal = normal.concat(
                normalize([po1[0], 0, po1[2]]),
                normalize([po2[0], 0, po2[2]]),
                normalize([po3[0], 0, po3[2]]),
                normalize([po4[0], 0, po4[2]])
            );
            texcoord.push(s, 0, s + sStep, 0, sStep + s, 1, s, 1);

            var pi1 = [innerRadius * Math.cos(angle), -height / 2, innerRadius * Math.sin(angle)];
            var pi2 = [innerRadius * Math.cos(nextAngle), -height / 2, innerRadius * Math.sin(nextAngle)];
            var pi3 = [innerRadius * Math.cos(nextAngle), height / 2, innerRadius * Math.sin(nextAngle)];
            var pi4 = [innerRadius * Math.cos(angle), height / 2, innerRadius * Math.sin(angle)];
            if (innerRadius !== 0) {
                position = position.concat(pi1, pi2, pi3, pi4);
                normal = normal.concat(
                    normalize([-pi1[0], 0, -pi1[2]]),
                    normalize([-pi2[0], 0, -pi2[2]]),
                    normalize([-pi3[0], 0, -pi3[2]]),
                    normalize([-pi4[0], 0, -pi4[2]])
                );
                texcoord.push(s, 0, s + sStep, 0, sStep + s, 1, s, 1);
            }

            position = position.concat(po1, po2, pi2, pi1, po4, po3, pi3, pi4);
            normal = normal.concat(
                [0, -1, 0], [0, -1, 0], [0, -1, 0], [0, -1, 0],
                [0,  1, 0], [0,  1, 0], [0,  1, 0], [0,  1, 0],
            );
            texcoord = texcoord.concat(
                getTexcoord(outerRadius, outerRadius, angle),
                getTexcoord(outerRadius, outerRadius, nextAngle),
                getTexcoord(innerRadius, outerRadius, nextAngle),
                getTexcoord(innerRadius, outerRadius, angle),
                getTexcoord(outerRadius, outerRadius, nextAngle),
                getTexcoord(outerRadius, outerRadius, angle),
                getTexcoord(innerRadius, outerRadius, angle),
                getTexcoord(innerRadius, outerRadius, nextAngle)
            );
        }

        for (var i = 0, len = position.length; i < len; i += 12) {
            indices.push(i / 3, i / 3 + 1, i / 3 + 2, i / 3 + 2, i / 3 + 3, i / 3);
        }

        mesh.position = position;
        mesh.normal = normal;
        mesh.indices = indices;
        mesh.texcoord = texcoord;
        transform && mesh.transform(transform);

        return mesh;
    };

    Mesh.bezierPlane = function (vertices, indices, numDivisions, option, transform) {
        numDivisions = numDivisions || 4;
        option = option || [gl.TRIANGLES];
        var position = [], normal = [], indice = [];
        var mesh = new Mesh(option);

        function bezier(u) {
            var b = [], a = 1 - u;
            b.push(u * u * u, 3 * a * u * u, 3 * a * a * u, a * a * a);
            return b;
        }

        function nbezier(u) {
            return [3 * u * u, 3 * u * (2 - 3 * u), 3 * (1 - 4 * u + 3 * u * u), -3 * (1 - u) * (1- u)];
        }

        var patch = [], indicesLen = indices.length,
            h = 1 / numDivisions, verticeLen = vertices.length;
        for (var i = 0; i < indicesLen; i++) {
            patch[i] = [];
            for (var j = 0; j < 16; j++) {
                patch[i][j] = vertices[indices[i][j]];
            }
        }

        for (var n = 0; n < indicesLen; n++) {
            var data = [];
            for (var i = 0; i <= numDivisions; i++) {
                data[i] = [];
                for (var j = 0; j <= numDivisions; j++) {
                    data[i][j] = [0, 0, 0];
                    var u = i * h, v = j * h, t = [];
                    for (var ii = 0; ii < 4; ii++) {
                        t[ii] = [];
                        for (var jj = 0; jj < 4; jj++) {
                            t[ii][jj] = bezier(u)[ii] * bezier(v)[jj];
                            var tempPoint = patch[n][4 * ii + jj];
                            var temp = [
                                tempPoint[0] * t[ii][jj], 
                                tempPoint[1] * t[ii][jj], 
                                tempPoint[2] * t[ii][jj]
                            ];
                            data[i][j] = [
                                temp[0] + data[i][j][0],
                                temp[1] + data[i][j][1],
                                temp[2] + data[i][j][2]
                            ];
                        }
                    }
                }
            }
            var ndata = [], tdata = [], sdata = [];
            for (var i = 0; i <= numDivisions; i++) {
                ndata[i] = [];
                tdata[i] = [];
                sdata[i] = [];
                for (var j = 0; j <= numDivisions; j++) {
                    ndata[i][j] = [0, 0, 0];
                    sdata[i][j] = [0, 0, 0];
                    tdata[i][j] = [0, 0, 0];
                    var u = j * h, v = j * h, tt = [], ss= [];
                    for (var ii = 0; ii < 4; ii++) {
                        tt[ii] = [];
                        ss[ii] = [];
                        for (var jj = 0; jj < 4; jj++) {
                            tt[ii][jj] = nbezier(u)[ii] * bezier(v)[jj];
                            ss[ii][jj] = bezier(u)[ii] * nbezier(v)[jj];

                            var tempPoint = patch[n][4 * ii + jj];
                            var temp = [
                                tempPoint[0] * tt[ii][jj], 
                                tempPoint[1] * tt[ii][jj], 
                                tempPoint[2] * tt[ii][jj]
                            ];
                            tdata[i][j] = [
                                temp[0] + tdata[i][j][0],
                                temp[1] + tdata[i][j][1],
                                temp[2] + tdata[i][j][2]
                            ];

                            temp = [
                                tempPoint[0] * ss[ii][jj], 
                                tempPoint[1] * ss[ii][jj], 
                                tempPoint[2] * ss[ii][jj]
                            ];
                            sdata[i][j] = [
                                temp[0] + sdata[i][j][0],
                                temp[1] + sdata[i][j][1],
                                temp[2] + sdata[i][j][2]
                            ];
                        }
                    }
                    ndata[i][j] = normalize([
                        tdata[i][j][1] * sdata[i][j][2] - tdata[i][j][2] * sdata[i][j][1],
                        tdata[i][j][2] * sdata[i][j][0] - tdata[i][j][0] * sdata[i][j][2],
                        tdata[i][j][0] * sdata[i][j][1] - tdata[i][j][1] * sdata[i][j][0]
                    ]);
                }
            }
            for (var i = 0; i < numDivisions; i++) {
                for (var j = 0; j < numDivisions; j++) {
                    position = position.concat(data[i][j], data[i + 1][j], 
                        data[i + 1][j + 1], data[i][j + 1]);
                    normal = normal.concat(ndata[i][j], ndata[i + 1][j], 
                        ndata[i + 1][j + 1], ndata[i][j + 1]);
                }
            }
        }

        for (var i = 0, len = position.length; i < len; i += 12) {
            indice.push(i / 3, i / 3 + 1, i / 3 + 2, i / 3 + 2, i / 3 + 3, i / 3);
        }

        mesh.position = position;
        mesh.normal = normal;
        mesh.indices = indice;
        transform && mesh.transform(transform);

        return mesh;
    };

    Mesh.svg = function (svgStr, data, option) {
        data.maxAngle = data.maxAngle || Math.PI / 6;
        option = option || [gl.TRIANGLES];
        var curvePoints;
        if (Mesh.svg[svgStr]) {
            curvePoints = Mesh.svg[svgStr];
        }
        else {
            curvePoints = parseSVGPath(svgStr, data.xFlip);
            Mesh.svg[svgStr] = curvePoints;
        }
        var tempPoints = getPointsOnBezierCurves(curvePoints, data.tolerance);
        var points = simplifyPoints(tempPoints, 0, tempPoints.length, data.distance);
        var tempArrays = lathePoints(points, data.startAngle, data.endAngle, data.divisions, 
            data.capStart, data.capEnd);
        var arrays = generateNormals(tempArrays, data.maxAngle);

        return Mesh.fromObj({
            position: arrays.position,
            texcoord: arrays.texcoord,
            indices: arrays.indices,
            normal: arrays.normal
        }, option);

        function parseSVGPath(svg, xFlip) {
            var points = [];
            var delta = false;
            var keepNext = false;
            var need = 0;
            var value = "";
            var values = [];
            var lastValues = [0, 0];
            var nextLastValues = [0, 0];
            var mode;

            function addValue() {
                if (value.length > 0) {
                    var v = parseFloat(value);
                    values.push(v);
                    if (values.length === 2) {
                        if (delta) {
                            values[0] += lastValues[0];
                            values[1] += lastValues[1];
                        }
                        points.push(values);
                        if (keepNext) {
                            nextLastValues = values.slice();
                        }
                        --need;
                        if (!need) {
                            if (mode == "l") {
                                var m2 = vec2.create(), m3 = vec2.create();

                                var m4 = points.pop();
                                var m1 = points.pop();
                                vec2.lerp(m2, m1, m4, 0.25);
                                vec2.lerp(m3, m1, m4, 0.75);
                                points.push(m1, m2, m3, m4);
                            }
                            lastValues = nextLastValues;
                        }
                        values = [];
                    }
                    value = "";
                }
            }

            svg.split("").forEach(function (c, ndx) {
                if ((c >= "0" && c <= "9") || c == ".") {
                    value += c;
                }
                else if (c == "-") {
                    addValue();
                    value = "-";
                }
                else if (c == "m") {
                    addValue();
                    keepNext = true;
                    need = 1;
                    delta = true;
                    mode = "m";
                }
                else if (c == "c") {
                    addValue();
                    keepNext = true;
                    need = 3;
                    delta = true;
                    mode = "c";
                }
                else if (c == "l") {
                    addValue();
                    keepNext = true;
                    need = 1;
                    delta = true;
                    mode = "l";
                }
                else if (c == "M") {
                    addValue();
                    keepNext = true;
                    need = 1;
                    delta = false;
                    mode = "m";
                }
                else if (c == "C") {
                    addValue();
                    keepNext = true;
                    need = 3;
                    delta = false;
                    mode = "c";
                }
                else if (c == "L") {
                    addValue();
                    keepNext = true;
                    need = 1;
                    delta = false;
                    mode = "l";
                }
                else if (c == "Z") {
                }
                else if (c == ",") {
                    addValue();
                }
                else if (c == " ") {
                    addValue();
                }
            });
            addValue();
            var min = points[0].slice();
            var max = points[0].slice();
            for (var i = 0; i < points.length; i++) {
                min = vec2.min(min, min, points[i]);
                max = vec2.max(max, max, points[i]);
            }
            var range = vec3.create(), halfRange = vec3.create();
            vec2.sub(range, max, min);
            vec2.scale(halfRange, range, 0.5);
            for (var i = 0; i < points.length; i++) {
                var p = points[i];
                if (xFlip) {
                    p[0] = max[0] - p[0];
                }
                else {
                    p[0] = p[0] - min[0];
                }
                
                p[1] = (p[1] - min[0]) - halfRange[1];
            }
            return points;
        }

        function getPointsOnBezierCurves(points, tolerance) {
            var newPoints = [];
            var numSegments = (points.length - 1) / 3;
            for (var i = 0; i < numSegments; i++) {
                var offset = i * 3;
                getPointsOnBezierCurveWithSplitting(points, offset, tolerance, newPoints);
            }

            return newPoints;
        }

        function getPointsOnBezierCurveWithSplitting(points, offset, tolerance, newPoints) {
            var outPoints = newPoints || [];
            if (flatness(points, offset) < tolerance) {
                // just add the end points of this curve
                outPoints.push(points[offset + 0]);
                outPoints.push(points[offset + 3]);
            }
            else {
                var q1 = vec2.create(), q2 = vec2.create(), q3 = vec2.create(),
                    r1 = vec2.create(), r2 = vec2.create(), red = vec2.create();
                var t = 0.5;
                var p1 = points[offset + 0];
                var p2 = points[offset + 1];
                var p3 = points[offset + 2];
                var p4 = points[offset + 3];

                vec2.lerp(q1, p1, p2, t);
                vec2.lerp(q2, p2, p3, t);
                vec2.lerp(q3, p3, p4, t);

                vec2.lerp(r1, q1, q2, t);
                vec2.lerp(r2, q2, q3, t);
                vec2.lerp(red, r1, r2, t);

                // do 1st half
                getPointsOnBezierCurveWithSplitting([p1, q1, r1, red], 0, tolerance, outPoints);
                // do 2nd half
                getPointsOnBezierCurveWithSplitting([red, r2, q3, p4], 0, tolerance, outPoints);
            }

            return outPoints;
        }

        function flatness(points, offset) {
            var p1 = points[offset + 0];
            var p2 = points[offset + 1];
            var p3 = points[offset + 2];
            var p4 = points[offset + 3];

            var ux = 3 * p2[0] - 2 * p1[0] - p4[0]; 
            ux *= ux;
            var uy = 3 * p2[1] - 2 * p1[1] - p4[1];
            uy *= uy;
            var vx = 3 * p3[0] - 2 * p4[0] - p1[0]; 
            vx *= vx;
            var vy = 3 * p3[1] - 2 * p4[1] - p1[1];
            vy *= vy;

            if (ux < vx) ux = vx;
            if (uy < vy) uy = vy;

            return ux + uy;
        }

        // Ramer Douglas peucker algorithm
        function simplifyPoints(points, start, end, epsilon, newPoints) {
            var outPoints = newPoints || [];

            // find the most distant point from the line formed by the endpoints
            var s = points[start];
            var e = points[end - 1];
            var maxDistSq = 0;
            var maxNdx = 1;
            for (let i = start + 1; i < end - 1; i++) {
                var distSq = vec2.distanceToSegmentSq(points[i], s, e);
                if (distSq > maxDistSq) {
                    maxDistSq = distSq;
                    maxNdx = i;
                }
            }

            // if the point is too far
            if (Math.sqrt(maxDistSq) > epsilon) {
                // split
                simplifyPoints(points, start, maxNdx + 1, epsilon, outPoints);
                simplifyPoints(points, maxNdx, end, epsilon, outPoints);
            }
            else {
                // add the 2 end points
                outPoints.push(s, e);
            }

            return outPoints;
        }

        // rotates around Y axis.
        // startAngle  angle to start at (ie 0)
        // angle to end at (ie Math.PI * 2)
        // how many quads to make around
        // true to cap the top
        // true to cap the bottom
        function lathePoints(points, startAngle, endAngle, numDivisions, capStart, capEnd) {
            var positions = [], texcoords = [], indices = [];
            var vOffset = capStart ? 1: 0;
            var pointsPerColumn = points.length + vOffset + (capEnd ? 1: 0);
            var quadsDown = pointsPerColumn - 1;
            var mat = mat4.create();

            // generate points
            for (var division = 0; division <= numDivisions; division++) {
                var u = division / numDivisions;
                var angle = startAngle + (endAngle - startAngle) * u;
                var mat = mat4.fromYRotation(mat, angle);

                if (capStart) {
                    // add point on Y access at start
                    positions.push(0, points[0][1], 0);
                    texcoords.push(u, 0);
                }
                points.forEach(function (p, ndx) {
                    var tp = vec3.fromValues(p[0], p[1], 0);
                    vec3.transformMat4(tp, tp, mat);

                    positions.push(tp[0], tp[1], tp[2]);
                    // note: this V is wrong. It's spacing by ndx instead of distance along curve
                    var v = (ndx + vOffset) / quadsDown;
                    texcoords.push(u, v);
                });

                if (capEnd) {
                    // add point on Y access at end
                    positions.push(0, points[points.length - 1][1], 0);
                    texcoords.push(u, 1);
                }
            }

            // generate indices
            for (var division = 0; division < numDivisions; division++) {
                var column1Offset = division * pointsPerColumn;
                var column2Offset = column1Offset + pointsPerColumn;
                for (var quad = 0; quad < quadsDown; quad++) {
                    indices.push(column1Offset + quad, column1Offset + quad + 1, column2Offset + quad);
                    indices.push(column1Offset + quad + 1, column2Offset + quad + 1, column2Offset + quad);
                }
            }

            return {
                position: positions,
                texcoord: texcoords,
                indices: indices
            };
        }

        function makeIndiceIterator(arrays) {
            return arrays.indices ? makeIndexedIndicesFn(arrays) : makeUnindexedIndicesFn(arrays);
        }

        function makeIndexedIndicesFn(arrays) {
            var indices = arrays.indices;
            var ndx = 0;
            var fn = function () {
                return indices[ndx++];
            };
            fn.reset = function () {
                ndx = 0;
            };
            fn.numElements = indices.length;
            return fn;
        }

        function makeUnindexedIndicesFn(arrays) {
            var ndx = 0;
            var fn = function () {
                return ndx++;
            };
            fn.reset = function () {
                ndx = 0;
            };
            fn.numElements = arrays.positions.length / 3;
            return fn;
        }

        function generateNormals(arrays, maxAngle) {
            var positions = arrays.position;
            var texcoords = arrays.texcoord;
    
            // first compute the normal of each face
            var getNextIndex = makeIndiceIterator(arrays);
            var numFaceVerts = getNextIndex.numElements;
            var numVerts = arrays.position.length;
            var numFaces = numFaceVerts / 3;
            var faceNormals = [];
    
            // Compute the normal for every face.
            // While doing that, create a new vertex for every face vertex
            for (var i = 0; i < numFaces; i++) {
                var a = vec3.create();
                var n1 = getNextIndex() * 3;
                var n2 = getNextIndex() * 3;
                var n3 = getNextIndex() * 3;
                var v1 = positions.slice(n1, n1 + 3);
                var v2 = positions.slice(n2, n2 + 3);
                var v3 = positions.slice(n3, n3 + 3);
                faceNormals.push(vec3.normalize(a, vec3.cross(a, vec3.subtract(v1, v1, v2), vec3.subtract(v3, v3, v2))));
            }
    
            var tempVerts = {};
            var tempVertNdx = 0;
    
            // this assumes vertex positions are an exact match
    
            function getVertIndex(x, y, z) {
                var vertId = x + "," + y + "," + z;
                var ndx = tempVerts[vertId];
                if (ndx !== undefined) {
                    return ndx;
                }
                var newNdx = tempVertNdx++;
                tempVerts[vertId] = newNdx;
                return newNdx;
            }
    
            // We need to figure out the shared vertices.
            // It's not as simple as looking at the faces (triangles)
            // because for example if we have a standard cylinder
            //
            //
            //      3-4
            //     /   \
            //    2     5   Looking down a cylinder starting at S
            //    |     |   and going around to E, E and S are not
            //    1     6   the same vertex in the data we have
            //     \   /    as they don't share UV coords.
            //      S/E
            //
            // the vertices at the start and end do not share vertices
            // since they have different UVs but if you don't consider
            // them to share vertices they will get the wrong normals
            var vertIndices = [];
            for (var i = 0; i < numVerts; i++) {
                var offset = i * 3;
                var vert = positions.slice(offset, offset + 3);
                vertIndices.push(getVertIndex(vert));
            }
    
            // go through every vertex and record which faces it's on
            var vertFaces = [];
            getNextIndex.reset();
            for (var i = 0; i < numFaces; i++) {
                for (var j = 0; j < 3; j++) {
                    var ndx = getNextIndex();
                    var sharedNdx = vertIndices[ndx];
                    var faces = vertFaces[sharedNdx];
                    if (!faces) {
                        faces = [];
                        vertFaces[sharedNdx] = faces;
                    }
                    faces.push(i);
                }
            }
    
            // now go through every face and compute the normals for each
            // vertex of the face. Only include faces that aren't more than
            // maxAngle different. Add the result to arrays of newPositions,
            // newTexcoords and newNormals, discarding ary vertices that
            // are the same.
            tempVerts = {};
            tempVertNdx = 0;
            var newPositions = [];
            var newTexcoords = [];
            var newNormals = [];
    
            function getNewVertIndex(x, y, z, nx, ny, nz, u, v) {
                var vertId = x + "," +  y + "," +  z + "," +
                            nx + "," + ny + "," + nz + "," +
                             u + "," +  v;
                var ndx = tempVerts[vertId];
                if (ndx !== undefined) {
                    return ndx;
                }
                var newNdx = tempVertNdx++;
                tempVerts[vertId] = newNdx;
                newPositions.push(x, y, z);
                newNormals.push(nx, ny, nz);
                newTexcoords.push(u, v);
                return newNdx;
            }
    
            var newVertIndices = [];
            getNextIndex.reset();
            var maxAngleCos = Math.cos(maxAngle);
            // for each face
            for (var i = 0; i < numFaces; i++) {
                var thisFaceVertexNormals = [];
                // get the normal for this face
                var thisFaceNormal = faceNormals[i];
                // for each vertex on the face
                for (var j = 0; j < 3; j++) {
                    var ndx = getNextIndex();
                    var sharedNdx = vertIndices[ndx];
                    var faces = vertFaces[sharedNdx];
                    var norm = [0, 0, 0];
    
                    faces.forEach(function (faceNdx) {
                        // is this face facing the same way
                        var otherFaceNormal = faceNormals[faceNdx];
                        var dot = vec3.dot(thisFaceNormal, otherFaceNormal);
                        if (dot > maxAngleCos) {
                            vec3.add(norm, otherFaceNormal, norm);
                        }
                    });
                    vec3.normalize(norm, norm);
                    var poffset = ndx * 3;
                    var toffset = ndx * 2;
                    newVertIndices.push(getNewVertIndex(
                        positions[poffset + 0], positions[poffset + 1], positions[poffset + 2],
                        norm[0], norm[1], norm[2],
                        texcoords[toffset + 0], texcoords[toffset + 1]
                    ));
                }
            }
    
            return {
                position: newPositions,
                texcoord: newTexcoords,
                normal: newNormals,
                indices: newVertIndices
            }
        }
    }

    function getTexcoord(radius, outRadius, theta) {
        var cos = Math.cos(theta),
            sin = Math.sin(theta);

        var s = (radius + radius * Math.cos(theta)) / (2 * outRadius);
            t = (radius + radius * Math.sin(theta)) / (2 * outRadius);

        return [s, t];
    }

    function normalize(list) {
        var len = Math.sqrt(list[0] * list[0], list[1] * list[1], list[2] * list[2]);
        return [list[0] / len, list[1] / len, list[2] / len];
    }

    function pickOctant(i) {
        return [(i & 1) * 2 - 1, (i & 2) - 1, (i & 4) / 2 - 1];
    }

    function computedNumByAttribName(buffer, str) {
        if (str.indexOf("coord") > 0) {
            buffer.numComponent = 2;
            return 2;
        }
        else if (str.indexOf("color") > 0) {
            buffer.numComponent = 4;
            return 4;
        }
        else {
            buffer.numComponent = 3;
            return 3;
        }
    }

    function computedType(buffer, type) {
        switch (type) {
            case Int8Array: 
                buffer.dataType = gl.BYTE;
                return gl.BYTE;
            case Uint8Array: 
                buffer.dataType = gl.UNSIGNED_BYTE;
                return gl.UNSIGNED_BYTE;
            case Int16Array: 
                buffer.dataType = gl.SHORT;
                return gl.SHORT;
            case Uint16Array: 
                buffer.dataType = gl.UNSIGNED_SHORT;
                return gl.UNSIGNED_SHORT;
            case Int32Array: 
                buffer.dataType = gl.INT;
                return gl.INT;
            case Uint32Array: 
                buffer.dataType = gl.UNSIGNED_INT;
                return gl.UNSIGNED_INT;
            case Float32Array: 
                buffer.dataType = gl.FLOAT;
                return gl.FLOAT;
            default: throw "unsopported typed array type";
        }
        return null;
    }

    function computedNormalize(buffer, type) {
        if (type === Int8Array || type === Uint8Array) {
            buffer.normalize = true;
            return true;
        }
        buffer.normalize = false;
        return false;
    }

    function isPower2(length) {
        return (length & (length - 1)) == 0;
    }

    function Indexer() {
        this.unique = [];
        this.indices = [];
        this.map = {};
    }
    
    Indexer.prototype = {
        add: function(obj) {
            var key = JSON.stringify(obj);
            if (!(key in this.map)) {
                this.map[key] = this.unique.length;
                this.unique.push(obj);
            }
            return this.map[key];
        }
    };

    function loadImages(imageSrc, backFn) {
        var len = imageSrc.length, images = new Array(6), count = 0;

        for (var ii = 0; ii < len; ii++) {
            var img = new Image();
            img.src = imageSrc[ii];
            (function () {
                img.onload = loadComplete(ii);
            })(ii);
            
        }

        function loadComplete(ii, ev) {
            return function (ev) {
                images[ii] = ev.target;
                count++;
                if (count == imageSrc.length) {
                    backFn(images);
                }
            }
        }
    }

    function Color(r, g, b, a) {
        this.r = r; 
        this.g = g;
        this.b = b;
        this.a = a === undefined ? 1.0 : a;
    }
    Color.prototype = {
        toArray: function () {
            return [this.r, this.g, this.b, this.a];
        },
        toLuminance: function () {
            return (0.2126 * this.r + 0.7152 * this.g + 0.0722 * this.b) * this.a;
        },
        toGl: function () {
            return [this.r / 255, this.g / 255, this.b / 255, this.a / 255];
        },
        toHSL: function color() {
            var a = this.a, g = this.g / 255, r = this.r / 255, b = this.b / 255;
            var max = Math.max( r, g, b );
            var min = Math.min( r, g, b );
            var hue, saturation;
            var lightness = ( min + max ) / 2.0;

            if ( min === max ) {
                hue = 0;
                saturation = 0;
            } else {
                var delta = max - min;
                saturation = lightness <= 0.5 ? delta / ( max + min ) : delta / ( 2 - max - min );
                switch ( max ) {
                    case r: hue = ( g - b ) / delta + ( g < b ? 6 : 0 ); break;
                    case g: hue = ( b - r ) / delta + 2; break;
                    case b: hue = ( r - g ) / delta + 4; break;
                }
                hue /= 6;
            }
            this.hsl = [hue * 360, saturation, lightness, this.a];
            return this.hsl;
        },
        setHue: function (value) {
            var hsl, color;

            this.hsl || this.toHSL();
            hsl = this.hsl.slice();
            hsl[0] = value;
            var color = Color.fromHSL.apply(Color, hsl);
            this.r = color.r;
            this.g = color.g;
            this.b = color.b;
            this.a = color.a;
            this.hsl = color.hsl;
            return this;
        },
        setSaturate: function (value) {
            var hsl, color;

            this.hsl || this.toHSL();
            hsl = this.hsl.slice();
            hsl[1] = value;
            var color = Color.fromHSL.apply(Color, hsl);
            this.r = color.r;
            this.g = color.g;
            this.b = color.b;
            this.a = color.a;
            this.hsl = color.hsl;
            return this;
        },
        setLightness: function (value) {
            var hsl, color;

            this.hsl || this.toHSL();
            hsl = this.hsl.slice();
            hsl[2] = value;
            var color = Color.fromHSL.apply(Color, hsl);
            this.r = color.r;
            this.g = color.g;
            this.b = color.b;
            this.a = color.a;
            this.hsl = color.hsl;
            return this;
        }
    };
    Color.random = function (isAlpha) {
        var r = randomInt(256), g = randomInt(256), b = randomInt(256), 
            a = isAlpha ? randomInt(256) : 255;

        return new Color(r, g, b, a);      
    };
    Color.fromStr = function (value) {
        if (value.indexOf("#") === 1) {
            var num = parseInt(value.slice(1), 16);
            var r = Math.floor(num / 65536);
            var g = Math.floor((num - r * 65536) / 256);
            var b = num % 256;
            return new Color(r, g, b, 1.0);
        }
    };
    Color.fromArray = function (list) {
        var r = list[0], g = list[1], b = list[2], 
            a = list[3] === undefined ? 1.0 : list[3];
        return new Color(r, g, b, a);
    }
    Color.fromHSL = function (h, s, l, a) {
        function hue2rgb(p, q, t) {
            if ( t < 0 ) t += 1;
            if ( t > 1 ) t -= 1;
            if ( t < 1 / 6 ) return p + ( q - p ) * 6 * t;
            if ( t < 1 / 2 ) return q;
            if ( t < 2 / 3 ) return p + ( q - p ) * 6 * ( 2 / 3 - t );
            return p;
        }

        h = h / 360;
        a = a === undefined ? 1.0 : a;
        var r, g, b;
        if (s === 0) {
            r = g = b = l;
        }
        else {
            var p = l <= 0.5 ? l * ( 1 + s ) : l + s - ( l * s );
            var q = ( 2 * l ) - p;

            r = hue2rgb( q, p, h + 1 / 3 );
            g = hue2rgb( q, p, h );
            b = hue2rgb( q, p, h - 1 / 3 );
        }

        r = Math.ceil(r * 255);
        g = Math.ceil(g * 255);
        b = Math.ceil(b * 255);
        var color = new Color(r , g , b , a);
        color.hsl = [h * 360, s, l, a];
        return color;
    };

    function randomInt(min, max) {
        if (max) {
            return min + Math.floor(Math.random() * (max - min));
        }
        return Math.floor(Math.random() * min);
    }

    var requestID, fn, then = 0, restoreArray = [];

    function animate(updateFn, drawFn) {
        fn = function (time) {
            resize(gl.canvas);
            time = time || 0;
            updateFn && updateFn((time - then) * 0.001, time * 0.001);
            drawFn && drawFn((time - then) * 0.001, time * 0.001);
            then = time;
            requestID = requestAnimationFrame(fn);
        }
        requestID = requestAnimationFrame(fn);
    }

    function stop() {
        cancelAnimationFrame(requestID);
        fn = null;
        then = 0;
    }

    function contextLost(ev) {
        cancelAnimationFrame(requestID);
        ev.preventDefault();
    }

    function restoreFn(ev) {
        for (var i = 0; i < restoreArray.length; i++) {
            restoreArray[i](ev);
        }
    }

    function addRestoreFn(fn) {
        resotreArray.push(fn);
    }

    function fullScreen(drawFn, width, height) {
        width = width || window.innerWidth;
        height = height || window.innerHeight;
        var marginTop = (window.innerHeight - height) / 2;
        var marignLeft = (window.innerWidth - width) / 2;
        var isTop = marginTop > 0, isLeft = marignLeft > 0;

        var marginStr = "margin: " + (isTop ? marginTop : 0) + "px " + 
            (isLeft ? marignLeft : 0) + "px"; 
        gl.canvas.width = isLeft ? width : window.innerWidth;
        gl.canvas.height = isTop ? height : window.innerHeight;

        gl.canvas.style.cssText = marginStr;
        if (!document.body.contains(gl.canvas)) {
            document.body.appendChild(gl.canvas);
        }
        
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        drawFn && drawFn(window.innerWidth, window.innerHeight);
    }

    var kernels = {
        normal: [
            0, 0, 0,
            0, 1, 0,
            0, 0, 0
          ],
          gaussianBlur: [
            0.045, 0.122, 0.045,
            0.122, 0.332, 0.122,
            0.045, 0.122, 0.045
          ],
          gaussianBlur2: [
            1, 2, 1,
            2, 4, 2,
            1, 2, 1
          ],
          gaussianBlur3: [
            0, 1, 0,
            1, 1, 1,
            0, 1, 0
          ],
          unsharpen: [
            -1, -1, -1,
            -1,  9, -1,
            -1, -1, -1
          ],
          sharpness: [
             0,-1, 0,
            -1, 5,-1,
             0,-1, 0
          ],
          sharpen: [
             -1, -1, -1,
             -1, 16, -1,
             -1, -1, -1
          ],
          edgeDetect: [
             -0.125, -0.125, -0.125,
             -0.125,  1,     -0.125,
             -0.125, -0.125, -0.125
          ],
          edgeDetect2: [
             -1, -1, -1,
             -1,  8, -1,
             -1, -1, -1
          ],
          edgeDetect3: [
             -5, 0, 0,
              0, 0, 0,
              0, 0, 5
          ],
          edgeDetect4: [
             -1, -1, -1,
              0,  0,  0,
              1,  1,  1
          ],
          edgeDetect5: [
             -1, -1, -1,
              2,  2,  2,
             -1, -1, -1
          ],
          edgeDetect6: [
             -5, -5, -5,
             -5, 39, -5,
             -5, -5, -5
          ],
          sobelHorizontal: [
              1,  2,  1,
              0,  0,  0,
             -1, -2, -1
          ],
          sobelVertical: [
              1,  0, -1,
              2,  0, -2,
              1,  0, -1
          ],
          previtHorizontal: [
              1,  1,  1,
              0,  0,  0,
             -1, -1, -1
          ],
          previtVertical: [
              1,  0, -1,
              1,  0, -1,
              1,  0, -1
          ],
          boxBlur: [
              0.111, 0.111, 0.111,
              0.111, 0.111, 0.111,
              0.111, 0.111, 0.111
          ],
          triangleBlur: [
              0.0625, 0.125, 0.0625,
              0.125,  0.25,  0.125,
              0.0625, 0.125, 0.0625
          ],
          emboss: [
             -2, -1,  0,
             -1,  1,  1,
              0,  1,  2
          ]
    };

    var MatrixStack = {
        stack: [mat4.create()],

        restore: function () {
            this.stack.pop();
            if (this.stack.length < 1) {
                this.stack[0] = mat4.create();
            }
            return this;
        },

        save: function (matrix) {
            var mt;
            if (matrix) {
                mt = mat4.clone(matrix);
            }
            else {
                mt = this.getCurrentMatrix();
            }
            this.stack.push(mt);
            return this;
        },

        getCurrentMatrix: function () {
            return mat4.clone(this.stack[this.stack.length - 1]);
        },

        setCurrentMatrix: function (m) {
            return mat4.copy(this.stack[this.stack.length - 1], m);
        },

        translate: function (x, y, z) {
            z = z || 0;
            var m = this.getCurrentMatrix();
            this.setCurrentMatrix(mat4.translate(m, m, [x, y, z]));
            return this;
        },

        rotateZ: function (axis) {
            var m = this.getCurrentMatrix();
            this.setCurrentMatrix(mat4.rotateZ(m, m, axis));
            return this;
        },

        rotateY: function (axis) {
            var m = this.getCurrentMatrix();
            this.setCurrentMatrix(mat4.rotateY(m, m, axis));
            return this;
        },

        rotateX: function (axis) {
            var m = this.getCurrentMatrix();
            this.setCurrentMatrix(mat4.rotateX(m, m, axis));
            return this;
        },

        scale: function (x, y, z) {
            z = z === undefined ? 1 : z;
            var m = this.getCurrentMatrix();
            this.setCurrentMatrix(mat4.scale(m, m, [x, y, z]));
            return this;
        },

        do: function (fn) {
            var a = Array.prototype.slice.call(arguments, 1);
            fn.apply(window, a);
            return this;
        }
    };

    function LevelTree(treeObj) {
        this.matrix = mat4.create();
        this.localMatrix = mat4.create();
        this.treeObj = treeObj;
        this.computedTree();
    }
    LevelTree.prototype.setNode = function (id, transform, render, sibling, child) {
        this.figure[id] = new Node(id, mat4.clone(transform), render, sibling, child);
    };
    LevelTree.prototype.traverse = function (id) {
        if (id == null) return;
        var figure = this.figure;
        MatrixStack.save(this.matrix);
        mat4.copy(this.localMatrix, figure[id].localTransform);
        mat4.mul(this.matrix, this.matrix, figure[id].transform);
        figure[id].options.hidden || figure[id].render();

        if (figure[id].child != null) this.traverse(figure[id].child);
        mat4.copy(this.matrix, MatrixStack.stack[MatrixStack.stack.length - 1]);
        MatrixStack.restore();
        if (figure[id].sibling != null) this.traverse(figure[id].sibling);
    };
    LevelTree.prototype.setTransform = function (name, transform) {
        var node = this.figure[name];
        node.rotate = transform.rotate || [0, 0, 0];
        node.translate = transform.translate || [0, 0, 0];
        node.setTransform();

        node.localRotate = transform.localRotate || [0, 0, 0];
        node.localTranslate = transform.localTranslate || [0, 0, 0];
        node.localScale = transform.localScale || [1, 1, 1];
        node.setLocalTransform();
    }
    LevelTree.prototype.changeTranslate = function (name, translate) {
        var node = this.figure[name];
        node.translate = translate;
        node.setTransform();
    }
    LevelTree.prototype.changeRotate = function (name, r) {
        var node = this.figure[name];
        node.rotate = r;
        node.setTransform();
    },
    LevelTree.prototype.changeLocalRotate = function (name, r) {
        var node = this.figure[name];
        node.localRotate = r;
        node.setLocalTransform();
    },
    LevelTree.prototype.changeLocalTranslate = function (name, translate) {
        var node = this.figure[name];
        node.localTranslate = translate;
        node.setLocalTransform();
    },
    LevelTree.prototype.changeLocalScale = function (name, scale) {
        var node = this.figure[name];
        node.localScale = scale;
        node.setLocalTransform();
    },
    LevelTree.prototype.computedTree = function () {
        this.figure = {};
        this.treeObj && createNode(this.treeObj, null, null, this.figure, this.treeObj.options);

        function createNode(t, parent, sibling, figure, options) {
            options = options || {};
            figure[t.name] = new Node(t.name, t.transform, t.render, null, null, options);
            if (t.children && t.children.length > 0) {
                for (var i = 0; i < t.children.length; i++) {
                    var a = t.children[i];
                    createNode(a, null, null, figure, a.options);
                    if (i == 0) {
                        figure[a.name].setParent(figure[t.name]);
                    }
                    else {
                        figure[a.name].setPrevSibling(figure[t.children[i - 1].name]);
                    }
                }
            }
        }
    }

    function Node(name, transform, render, sibling, child, options) {
        this.name = name;
        this.transform = mat4.create();
        this.render = render;
        this.sibling = sibling;
        this.child = child;
        this.options = options || {};
        this.translate = transform.translate || [0, 0, 0];
        this.rotate = transform.rotate || [0, 0, 0];

        this.localTransform = mat4.create();
        this.localRotate = transform.localRotate || [0, 0, 0];
        this.localTranslate = transform.localTranslate || [0, 0, 0];
        this.localScale = transform.localScale || [1, 1, 1];

        this.setTransform();
        this.setLocalTransform();
    }
    Node.prototype.setTransform = function () {
        var r = this.rotate;
        var translate = this.translate;
        var rotate = quat.create();
        quat.rotateX(rotate, rotate, r[0]);
        quat.rotateY(rotate, rotate, r[1]);
        quat.rotateZ(rotate, rotate, r[2]);
        mat4.fromRotationTranslation(this.transform, rotate, translate);
    };
    Node.prototype.setLocalTransform = function () {
        var localR = this.localRotate;
        var localT = this.localTranslate;
        var localS = this.localScale;

        var rl = quat.create();
        quat.rotateX(rl, rl, localR[0]);
        quat.rotateY(rl, rl, localR[1]);
        quat.rotateZ(rl, rl, localR[2]);
        
        mat4.fromRotationTranslationScale(this.localTransform, rl, localT, localS);
    };
    Node.prototype.setParent = function (node) {
        node.child = this.name;
    };
    Node.prototype.setPrevSibling = function (node) {
        node.sibling = this.name;
    };
    Node.prototype.setChild = function (node) {
        this.child = node.name;
    };
    Node.prototype.setNextSibling = function (node) {
        this.sibling = node.name;
    }

    function requestCORSIfNotSameOrigin(img, url) {
        if ((new URL(url)).origin !== window.location.origin) {
            img.crossOrigin = "";
        }
    }

    function resize(canvas) {
        var displayWidth = canvas.clientWidth;
        var displayHeight = canvas.clientHeight;

        if (canvas.width != displayWidth || canvas.height !== displayHeight) {

            canvas.width = displayWidth;
            canvas.height = displayHeight;
        }
    }

    return {
        create: create,
        Controller: ControllerUtil,
        Program: Program,
        Buffer: Buffer,
        Texture: Texture,
        Mesh: Mesh,
        loadImages: loadImages,
        animate: animate,
        stop: stop,
        fullScreen: fullScreen, 
        Color: Color,
        kernels: kernels,
        MatrixStack: MatrixStack,
        addRestoreFn: addRestoreFn,
        Primitive: Primitive,
        LevelTree: LevelTree
    }
})();