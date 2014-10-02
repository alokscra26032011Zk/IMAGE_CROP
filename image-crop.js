/** 
 * Inspired from AngularJS Directive - Image Crop v1.0
 * Copyright (c) 2014 Andy Shora, andyshora@gmail.com, andyshora.com
 * Licensed under the MPL License
 	Modified by Bastien DOLLA (septembre 2014);
 */
(function() {

'use strict';


angular.module('profils')
    .directive('imageCrop', ['$interval', function($interval) {
    return {
      templateUrl: 'image-crop.html',
      replace: true,
      restrict: 'AE',
      scope: {
        width: '@',
        height: '@',
        shape: '@',
        result: '=',
        withThumbS: '@?',
        withThumbXs: '@?',
        results: '=?',
        resultxs: '=?',
        step: '='
      },
      link: function (scope, element, attributes) {
      
        scope.step = scope.step || 1;
        scope.shape = scope.shape || 'circle';
        scope.width = parseInt(scope.width, 10) || 300;
        scope.height = parseInt(scope.height, 10) || 300;

		//adding 50 px border to the wanted image size
		var borderSize = 50;
		scope.canvasWidth = scope.width + 2*borderSize; //used in template
        scope.canvasHeight = scope.height + 2*borderSize; //used in template
        
        var TO_RADIANS = Math.PI/180;
        
        //in case of thumbnail
        var thumbWidth = Math.floor( scope.width * 0.5 );
        var thumbHeight = Math.floor( scope.height * 0.5 );
        var thumbxsWidth = Math.floor( scope.width * 0.16 );
        var thumbxsHeight = Math.floor( scope.height * 0.16 );
        

        var $input = element.find('input[type=file]');
        var $canvas = element.find('canvas')[0];
        var $btnZoomPlus = document.getElementsByClassName('zoom-btn-plus')[0];
        var $btnZoomMinus = document.getElementsByClassName('zoom-btn-minus')[0];

        var $finalImg = document.getElementsByClassName('final-cropped-image')[0];
        var $img = new Image();
        var fileReader = new FileReader();

        var maxLeft = 0,
			minLeft = 0, 
			maxTop = 0, 
			minTop = 0, 
        	currentX = 0, 
        	currentY = 0,
        	targetX = 0,
        	targetY = 0, 
        	dragging = false, 
        	startX = 0, 
        	startY = 0, 
        	zooming = false,
        	newWidth = 0, 
        	newHeight = 0,
        	zoom = 1,
        	maxZoomedInLevel = 0, 
        	maxZoomedOutLevel = 2,
        	minXPos = 0, 
        	maxXPos = borderSize, 
        	minYPos = 0, 
        	maxYPos = borderSize, // for dragging bounds
        	ctx = $canvas.getContext('2d'),
        	files = [],
        	intervalPromise,
        	vertSquashRatio,
        	agRot = 0;

        // ---------- INLINE STYLES ----------- //
        scope.moduleStyles = {
          	width: scope.canvasWidth + 'px',
          	height: scope.canvasHeight + 'px'
        };

        scope.sectionStyles = {
          width: scope.canvasWidth + 'px',
          height: scope.canvasHeight + 'px'
        };

        scope.croppingGuideStyles = {
          width: scope.width + 'px',
          height: scope.height + 'px',
          top: borderSize + 'px',
          left: borderSize + 'px'
        };

        // ---------- EVENT HANDLERS ---------- //
        fileReader.onload = function(e) {
          $img.src = this.result;
          scope.step = 2;
          scope.$apply();
        };

        function reset() {
          	files = [];
          	zoom = 1;
          	ctx.clearRect(0, 0, $canvas.width, $canvas.height);
          	//document.getElementsByClassName('image-crop-filepicker')[0].value = null;
          	$img.src = '';
          	agRot = 0;  
          	scope.step = 1;
          	currentX = 0; 
        	currentY = 0;
        }

        element.on('change', function(e){
          files = e.target.files;
          fileReader.readAsDataURL(files[0]);
         });

        $img.onload = function() {
			
			vertSquashRatio = detectVerticalSquash(this);
          	newWidth = this.width;
          	newHeight = this.height;
          	currentX = 0;
          	currentY = 0;

          	updateBounds();
          	zoom = maxZoomedInLevel; //zoom image to fill canvas on initial load
          	centerZoomImage();

        };

        // ---------- PRIVATE FUNCTIONS ---------- //
        /**
		 * Detecting vertical squash in loaded image.
		 * Fixes a bug which squash image vertically while drawing into canvas for some images.
		 * This is a bug in certain iOS devices. This function from https://github.com/stomita/ios-imagefile-megapixel
		 * 
		 */
		function detectVerticalSquash(img) {
			var iw = img.naturalWidth, ih = img.naturalHeight;
			var canvas = document.createElement('canvas');
			canvas.width = 1;
			canvas.height = ih;
			var cx = canvas.getContext('2d');
			cx.drawImage(img, 0, 0);
			var data = cx.getImageData(0, 0, 1, ih).data;
			// search image edge pixel position in case it is squashed vertically.
			var sy = 0;
			var ey = ih;
			var py = ih;
			while (py > sy) {
				var alpha = data[(py - 1) * 4 + 3];
				if (alpha === 0) {
					ey = py;
				} else {
					sy = py;
				}
				py = (ey + sy) >> 1;
			}
			var ratio = (py / ih);
			return (ratio===0)?1:ratio;
		}

		/**
		 * A replacement for context.drawImage
		 * (args are for source and destination).
		 */
		function drawImageIOSFix(ctx, img, sx, sy, sw, sh, dx, dy, dw, dh) {
			
			ctx.drawImage(img, sx * vertSquashRatio, sy * vertSquashRatio, 
							   sw * vertSquashRatio, sh * vertSquashRatio, 
							   dx, dy, dw, dh );
		}
        
        
        
        function drawImg(x, y, w, h, angle){

            ctx.save();
            ctx.clearRect(0, 0, $canvas.width, $canvas.height);  
            ctx.translate($canvas.width/2, $canvas.height/2); 
            ctx.rotate(angle * TO_RADIANS);
            
         	x = x - ($canvas.width / 2);
         	y = y - ($canvas.height / 2);
         	
         	switch (angle) {
         		case 0:
         			drawImageIOSFix(ctx, $img, 0, 0, $img.width, $img.height, x, y, w, h);
         			break;
         		case 90:
         			drawImageIOSFix(ctx, $img, 0, 0, $img.width, $img.height, y, -x, w, -h);
         			break;
         		case 180:
         			drawImageIOSFix(ctx, $img, 0, 0, $img.width, $img.height, -x, -y, -w, -h);
         			break;
				case 270:
					drawImageIOSFix(ctx, $img, 0, 0, $img.width, $img.height, -y, x, -w, h);
         			break;
         	}
         	ctx.restore();

          	
        }
        
        function moveImage(x, y) {
        	x = (x >= minXPos && x <= maxXPos)? x : ((x < minXPos)? minXPos : maxXPos);
        	y = (y >= minYPos && y <= maxYPos)? y : ((y < minYPos)? minYPos : maxYPos);
          	drawImg(x, y, newWidth, newHeight, agRot);
          	targetX = x;
          	targetY = y;
        }
                
        function centerZoomImage(){       	
        	
        	zoomImage(zoom);
        	currentX = borderSize - Math.round((newWidth - scope.width)/2);
        	currentY = borderSize - Math.round((newHeight - scope.height)/2);
        	moveImage(currentX, currentY);
        }

        function to2Dp(val) {
          	return Math.round(val * 1000) / 1000;
        }

        function updateBounds() {
          	minXPos = $canvas.width - ((agRot % 180) === 0 ? newWidth : newHeight) - borderSize;
          	minYPos = $canvas.height - ((agRot % 180) === 0 ? newHeight : newWidth) - borderSize;
          	maxZoomedInLevel = Math.max(scope.width / ((agRot % 180) === 0 ? $img.width : $img.height), scope.height / ((agRot % 180) === 0 ? $img.height : $img.width));
        }
        
        scope.rotateImage = function() {
        	var _Y = currentY;
        	agRot = (agRot + 90) % 360;
        	currentY = currentX;
        	currentX = $canvas.width - _Y - ((agRot % 180) === 0 ? newWidth : newHeight);
        	updateBounds();   		
    		drawImg(currentX, currentY, newWidth, newHeight, agRot); 
        };

        function zoomImage(val) {
          	
          	if (!val) {
           	 	return;
          	}
          	
         	var proposedZoomLevel = to2Dp(zoom*(1+val));
         	proposedZoomLevel = ((proposedZoomLevel >= maxZoomedInLevel) && (proposedZoomLevel <= maxZoomedOutLevel))? 
         		proposedZoomLevel :
         		((proposedZoomLevel < maxZoomedInLevel)? maxZoomedInLevel: maxZoomedOutLevel);

			newWidth = $img.width * proposedZoomLevel;
			newHeight = $img.height * proposedZoomLevel;

			var newXPos = currentX - Math.round((borderSize + scope.width/2 -currentX)*(proposedZoomLevel - zoom)*$img.width / newWidth);
			var newYPos = currentY - Math.round((borderSize + scope.height/2 - currentY)*(proposedZoomLevel - zoom)*$img.height / newHeight);

			// check if we've exposed the gutter
			newXPos = (newXPos < minXPos)? 
				minXPos : 
				((newXPos > maxXPos)? maxXPos : newXPos);
			newYPos = (newYPos < minYPos)? 
				minYPos : 
				((newYPos > maxYPos)? maxYPos : newYPos);
				
          	zoom = proposedZoomLevel;
          	currentX = newXPos;
          	currentY = newYPos;
          	updateBounds();
          	
          	// draw image
          	drawImg(newXPos, newYPos, newWidth, newHeight, agRot);
        }


        // ---------- SCOPE FUNCTIONS ---------- //

        $finalImg.onload = function() {
                
            var tempCanvas = document.createElement('canvas');
          	tempCanvas.width = scope.width;
          	tempCanvas.height = scope.height;
          	tempCanvas.style.display = 'none';

          	var tempCanvasContext = tempCanvas.getContext('2d');
         	tempCanvasContext.drawImage($finalImg, -borderSize, -borderSize);

          	document.getElementsByClassName('section-final')[0].appendChild(tempCanvas);
          	scope.result = tempCanvas.toDataURL();
          
          	//if needed proceed to create the other smaller images
          	
         		var tempCanvasThumb = document.createElement('canvas');
         		var tempCanvasThumbContext = tempCanvasThumb.getContext('2d');
         		
         		
         	if (scope.withThumbS) {
          
          		//first thumbnail small size
			 	
			  	tempCanvasThumb.width = thumbWidth;
			 	tempCanvasThumb.height = thumbHeight;
			  	tempCanvasThumb.style.display = 'none';

			  
			  	tempCanvasThumbContext.drawImage($finalImg, borderSize, borderSize, this.width-2*borderSize, this.height-2*borderSize, 0, 0, thumbWidth, thumbHeight);
			  	scope.results = tempCanvasThumb.toDataURL();
			  	
			}
			
			if (scope.withThumbXs){
			
				//second thumbnail extra small size
			  
			  	tempCanvasThumb.width = thumbxsWidth;
			  	tempCanvasThumb.height = thumbxsHeight;
			  	tempCanvasThumb.style.display = 'none';

			  	tempCanvasThumbContext = tempCanvasThumb.getContext('2d');
			  	tempCanvasThumbContext.drawImage($finalImg, borderSize, borderSize, this.width-2*borderSize, this.height-2*borderSize, 0, 0, thumbxsWidth, thumbxsHeight);
			  	scope.resultxs = tempCanvasThumb.toDataURL();
		  
         	}
         	
          	scope.$apply();
          	reset();
        };

        scope.crop = function() {
          	scope.croppedDataUri = $canvas.toDataURL();
          	scope.step = 3;
        };
        
        //**** event listeners ****
        
        function addBodyEventListener(eventName, func) {
          	document.documentElement.addEventListener(eventName, func, false);
        }

        function removeBodyEventListener(eventName, func) {
          	document.documentElement.removeEventListener(eventName, func);
        }

        scope.onCanvasMouseUp = function(e) {

          	if (!dragging) return;
          	e.preventDefault();
          	e.stopPropagation(); // if event was on canvas, stop it propagating up

          	dragging = false;
          	currentX = targetX;
          	currentY = targetY;

          	removeBodyEventListener('mouseup', scope.onCanvasMouseUp);
          	removeBodyEventListener('touchend', scope.onCanvasMouseUp);
          	removeBodyEventListener('mousemove', scope.onCanvasMouseMove);
          	removeBodyEventListener('touchmove', scope.onCanvasMouseMove);

        };

        scope.onCanvasMouseDown = function(e) {
          	
          	startX = e.type === 'touchstart' ? e.changedTouches[0].clientX : e.clientX;
          	startY = e.type === 'touchstart' ? e.changedTouches[0].clientY : e.clientY;
          	
          	zooming = false;
          	dragging = true;

          	addBodyEventListener('mouseup', scope.onCanvasMouseUp);
          	addBodyEventListener('touchend', scope.onCanvasMouseUp);
          	addBodyEventListener('mousemove', scope.onCanvasMouseMove);
          	addBodyEventListener('touchmove', scope.onCanvasMouseMove);
        };
        
        $canvas.addEventListener('touchend', scope.onCanvasMouseUp, false);
        $canvas.addEventListener('touchstart', scope.onCanvasMouseDown, false);
        $canvas.addEventListener('touchmove', scope.onCanvasMouseMove, false);
		
		scope.onCanvasMouseMove = function(e) {

			e.preventDefault();
			e.stopPropagation();
			if (!dragging) {
				return;
			}
			var diffX = startX - ((e.type === 'touchmove') ? e.changedTouches[0].clientX : e.clientX); // how far mouse has moved in current drag
			var diffY = startY - ((e.type === 'touchmove') ? e.changedTouches[0].clientY : e.clientY); // how far mouse has moved in current drag
		 
			moveImage(currentX - diffX, currentY - diffY);

		};

				
        scope.onZoomPlusBtnMouseDown = function(e) {

          	e.preventDefault();
         	e.stopPropagation(); // if event was on handle, stop it propagating up
          	dragging = false;
          	zooming = true;
          	intervalPromise = $interval(zoomPlus, 10);
          
        };

        scope.onZoomPlusBtnMouseUp = function(e) {

          	// this is applied on the whole section so check we're zooming
          	if (!zooming) {
            	return;
          	}
          	e.preventDefault();
          	e.stopPropagation(); // if event was on canvas, stop it propagating up
          	zooming = false;
          	$interval.cancel(intervalPromise);
        };
        
        scope.onZoomMinusBtnMouseDown = function(e) {

          	e.preventDefault();
         	e.stopPropagation(); // if event was on handle, stop it propagating up
          	dragging = false;
          	zooming = true;
          	intervalPromise = $interval(zoomMinus, 50);
          	
        };

        scope.onZoomMinusBtnMouseUp = function(e) {

          	// this is applied on the whole section so check we're zooming
          	if (!zooming) {
            	return;
          	}
          	e.preventDefault();
          	e.stopPropagation(); // if event was on canvas, stop it propagating up
          	zooming = false;
          	$interval.cancel(intervalPromise);
          
        };

		$btnZoomPlus.addEventListener('touchend', scope.onZoomPlusBtnMouseUp, false);
        $btnZoomPlus.addEventListener('touchstart', scope.onZoomPlusBtnMouseDown, false);
        $btnZoomMinus.addEventListener('touchend', scope.onZoomMinusBtnMouseUp, false);
        $btnZoomMinus.addEventListener('touchstart', scope.onZoomMinusBtnMouseDown, false);

        
        var zoomPlus = function(){
          	zoomImage(0.05);
        };
        
        var zoomMinus = function(){
          	zoomImage(-0.1);
        };
        
        scope.$on('$destroy', function () {
        	$interval.cancel(intervalPromise);
          	removeBodyEventListener('mouseup', scope.onCanvasMouseUp);
          	removeBodyEventListener('touchend', scope.onCanvasMouseUp);
          	removeBodyEventListener('mousemove', scope.onCanvasMouseMove);
          	removeBodyEventListener('touchmove', scope.onCanvasMouseMove);
        	$canvas.removeEventListener('touchend', scope.onCanvasMouseUp);
        	$canvas.removeEventListener('touchstart', scope.onCanvasMouseDown);
        	$canvas.removeEventListener('touchmove', scope.onCanvasMouseMove);
        	$btnZoomPlus.removeEventListener('touchend', scope.onZoomPlusBtnMouseUp);
        	$btnZoomPlus.removeEventListener('touchstart', scope.onZoomPlusBtnMouseDown);
        	$btnZoomMinus.removeEventListener('touchend', scope.onZoomMinusBtnMouseUp);
        	$btnZoomMinus.removeEventListener('touchstart', scope.onZoomMinusBtnMouseDown);
        });

    }
};
}]);


})();