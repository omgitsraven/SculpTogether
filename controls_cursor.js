function SETUP_cursor(){
	
	
	
	var clickCatcherHolder = new THREE.Object3D();
	clickCatcherHolder.name = "CLICK CATCHER HOLDER";
	
	
	var clickCatcherMaterial = new THREE.MeshBasicMaterial({visible:false});//map:THREE.ImageUtils.loadTexture("debug.png"),side:THREE.DoubleSide});//
	var catcherSides = 8;
	var catcherRad = 2;
	var catcherHeight = 2.8;
	var clickCatcherSideGeom = new THREE.PlaneGeometry(catcherRad*2,catcherHeight);//this is wider than necessary but that doesn't hurt anything
	
	var hitzoneScaleFactor = 1/0.6;
	
	for(var i=0; i<catcherSides; i++){
		var catcherSide = new THREE.Mesh(clickCatcherSideGeom,clickCatcherMaterial);
		var myAng = (i/catcherSides)*Math.PI*2;
		catcherSide.position.set(
			Math.cos(myAng)*catcherRad,
			0,
			Math.sin(myAng)*catcherRad
		);
		catcherSide.rotation.y = -myAng-Math.PI/2;
		catcherSide.scale.set(hitzoneScaleFactor,hitzoneScaleFactor,hitzoneScaleFactor);
		clickCatcherHolder.add(catcherSide);
	}
	
	var clickCatcherCapGeom = new THREE.PlaneGeometry(catcherRad*2,catcherRad*2);
	var clickCatcherTop = new THREE.Mesh(clickCatcherCapGeom,clickCatcherMaterial);
	clickCatcherTop.rotation.x = Math.PI/2;
	clickCatcherTop.position.y = catcherHeight/2;
	clickCatcherTop.scale.set(hitzoneScaleFactor,hitzoneScaleFactor,hitzoneScaleFactor);
	clickCatcherHolder.add(clickCatcherTop);
	
	var clickCatcherFloor = new THREE.Mesh(clickCatcherCapGeom,clickCatcherMaterial);
	clickCatcherFloor.rotation.x = -Math.PI/2;
	clickCatcherFloor.position.y = -catcherHeight/2;
	clickCatcherFloor.scale.set(hitzoneScaleFactor,hitzoneScaleFactor,hitzoneScaleFactor);
	clickCatcherHolder.add(clickCatcherFloor);
	
	
	
	
	
	
	
	var scaleCubeWireThickness = 0.005;
	var scaleCubeSize = 0.3;
	var scaleCubeMat = new THREE.MeshBasicMaterial({color:0xFFFFFF});
	
	var scaleRefCube = new THREE.Object3D();
	var scaleRefCubeBars = [];
	for(var y=-1; y<=1; y+=2){
		for(var z=-1; z<=1; z+=2){
			
			var curCrossbar = new THREE.Mesh(
				new THREE.BoxGeometry( scaleCubeSize+scaleCubeWireThickness, scaleCubeWireThickness, scaleCubeWireThickness ),
				scaleCubeMat
			);
			curCrossbar.position.set(0,scaleCubeSize*0.5*y,scaleCubeSize*0.5*z);
			scaleRefCube.add(curCrossbar);
			scaleRefCubeBars.push(curCrossbar);
			
		}
	}
	for(var x=-1; x<=1; x+=2){
		for(var i=-1; i<=1; i+=2){
			
			var curYBar = new THREE.Mesh(
				new THREE.BoxGeometry( scaleCubeWireThickness, scaleCubeWireThickness, scaleCubeSize+scaleCubeWireThickness ),
				scaleCubeMat
			);
			curYBar.position.set( scaleCubeSize*0.5*x, scaleCubeSize*0.5*i, 0 );
			scaleRefCube.add(curYBar);
			scaleRefCubeBars.push(curYBar);
			
			var curZBar = new THREE.Mesh(
				new THREE.BoxGeometry( scaleCubeWireThickness, scaleCubeSize+scaleCubeWireThickness, scaleCubeWireThickness ),
				scaleCubeMat
			);
			curZBar.position.set( scaleCubeSize*0.5*x, 0, scaleCubeSize*0.5*i );
			scaleRefCube.add(curZBar);
			scaleRefCubeBars.push(curZBar);
			
		}
	}
	
	mergeObjects(scaleRefCubeBars,scaleRefCube,scaleCubeMat);
	
	
	
	
	
	
	
	
	
	
	
	var indicatorMat = new THREE.MeshBasicMaterial({color:0xFF00FF,side:THREE.DoubleSide,transparent:true,opacity:0.5});
	var dragIndicatorPlane = new THREE.Mesh(
		new THREE.PlaneGeometry(scaleCubeSize,0.01),
		indicatorMat
	);
	makeIntangible(dragIndicatorPlane);
	
	
	
	
	var rotIndicatorOuterRad = scaleCubeSize*0.4;
	var rotIndicatorInnerRad = rotIndicatorOuterRad*0.9;
	
	var rotIndicatorGeom = new THREE.Geometry();
	var steps=24;
	for(var i=0; i<=steps; i++){
		var ang = (i/steps)*Math.PI*2;
		rotIndicatorGeom.vertices.push(
			new THREE.Vector3(
				0,
				Math.sin(ang)*rotIndicatorOuterRad,
				Math.cos(ang)*rotIndicatorOuterRad
			),
			new THREE.Vector3(
				0,
				Math.sin(ang)*rotIndicatorInnerRad,
				Math.cos(ang)*rotIndicatorInnerRad
			)
		);
		if (i) {
			var curIndex = i*2;
			rotIndicatorGeom.faces.push(
				new THREE.Face3(
					curIndex-2,
					curIndex,
					curIndex-1
				),
				new THREE.Face3(
					curIndex,
					curIndex+1,
					curIndex-1
				)
			);
		}
	}
	for(var x=-1; x<=1; x+=2){
		for(var y=0; y<=1; y+=1){
			rotIndicatorGeom.vertices.push(new THREE.Vector3(
				0,
				y*rotIndicatorInnerRad*0.9,
				x*(rotIndicatorOuterRad-rotIndicatorInnerRad)/2
			));
		}
	}
	rotIndicatorGeom.faces.push(
		new THREE.Face3(
			rotIndicatorGeom.vertices.length-4,
			rotIndicatorGeom.vertices.length-3,
			rotIndicatorGeom.vertices.length-1
		),
		new THREE.Face3(
			rotIndicatorGeom.vertices.length-4,
			rotIndicatorGeom.vertices.length-1,
			rotIndicatorGeom.vertices.length-2
		)
	);
	var rotIndicatorMesh = new THREE.Mesh(
		rotIndicatorGeom,
		indicatorMat
	);
	makeIntangible(rotIndicatorMesh);
	var rotIndicatorHolder= new THREE.Object3D();
	rotIndicatorHolder.add(rotIndicatorMesh);
	
	
	
	
	var cubeClickerShellMult = 1.5;
	var cubeClickersHolder = new THREE.Object3D();
	var dragging = false;
	var cubeHovering = false;
	var dragProgressAmt = 0;
	var transformAxis;
	var cubeClickCatcherPlanes = [];
	
	var curDraggingUpdateFunc;
	
	function makeSide(rot,axis,cubeSide){
		
		function assignDragFunctions(mesh,shellSide){
			
			var dragMtx = new THREE.Matrix4();
			var dragStartAmt;
			
			function refreshDragMtx(){
				
				var grabMtx = mesh.matrixWorld.clone();//the object's orientation
				//grabMtx.multiply( new THREE.Matrix4().makeRotationFromEuler(rot) );//the axis's orientation
				grabMtx.multiply( new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0,Math.PI/2,0)) );//point the axis in X for my mental math (maybe dumb??)
				dragMtx.getInverse(grabMtx);
				
			}
			
			
			
			function updateCubeMidDrag(){
				
				var oldVal = getOldRayAmt();
				
				updateCubePos(true);
				refreshDragMtx();
				
				var newVal = getOldRayAmt();
				
				dragStartAmt += (newVal-oldVal);
				
			}
			
			
			var oldRay;
			function getOldRayAmt(){
				return getRayAmt(oldRay);
			}
			function getRayAmt(ray){
				
				
				oldRay = ray;
				
				
				var rotateMode = (curMode == EDITMODES.Turn);
				
				
				var uiObj = rotateMode ? rotIndicatorHolder : dragIndicatorPlane ;
				
				
				
				// transform ray into axis's orientation (assuming axis X) -- maybe even with grab point as origin?
				// rotate ray around axis by angle between ray and axis
				// take ray's Y at axis's Z
				var localRay = ray.clone();
				localRay.applyMatrix4(dragMtx);
				var pivotMtx = new THREE.Matrix4();
				if (!rotateMode) {
					var pivot = Math.atan2(localRay.origin.y,localRay.origin.z);
					pivotMtx.makeRotationFromEuler(new THREE.Euler(pivot,0,0));
					localRay.applyMatrix4(pivotMtx);
				}
				
				
				var uiInvMtx = pivotMtx.clone();
				uiInvMtx.multiply(dragMtx);
				var uiMtx = new THREE.Matrix4().getInverse(uiInvMtx);
				uiObj.matrix.identity();
				uiObj.applyMatrix(uiMtx);
				scene.add(uiObj);
				
				
				
				
				
				if (rotateMode) {
					
					if (Math.abs(localRay.direction.x < 0.001)) localRay.direction.x = 0.001;
					//I mean there's no good way to fix this, is there? but it's also extremely unlikely...
					
					var stepsToWall = -localRay.origin.x / localRay.direction.x;
					var wallZ = localRay.origin.z + localRay.direction.z*stepsToWall;
					var wallY = localRay.origin.y + localRay.direction.y*stepsToWall;
					
					var wallAng = Math.atan2(wallZ,wallY);
					rotIndicatorMesh.rotation.x = wallAng;
					
					return wallAng;
					
				} else {//move, scale
					
					if (Math.abs(localRay.direction.z < 0.001)) localRay.direction.z = 0.001;
					//I mean there's no good way to fix this, is there? but it's also extremely unlikely...
					
					var stepsToWall = -localRay.origin.z / localRay.direction.z;
					var wallX = localRay.origin.x + localRay.direction.x*stepsToWall;
					
					return wallX;
					
				}
				
				
				
				
			}
			
			function mouseupFunc(){
				dragging = false;
				scene.removeEventListener('cursorup',mouseupFunc);
				scene.removeEventListener('cursormove',mousemoveDragFunc);
				
				//will remove them even if you let go while still over, but I don't care honestly
				scene.remove(dragIndicatorPlane);
				scene.remove(rotIndicatorHolder);
				
				updateEnabledness();//to work around 'teleport on mouseup' altspace bug :(
				
				curDraggingUpdateFunc = null;
			}
			function mousemoveDragFunc(e){
				
				var curDragAmt = getRayAmt(e.ray);
				
				var actualStretchDist = curDragAmt-dragStartAmt;
				switch(curMode) {
					case EDITMODES.Slide:
						actualStretchDist *= cubeSide;
					break;
					case EDITMODES.Turn:
						actualStretchDist *= -cubeSide;
					break;
					case EDITMODES.Stretch:
						actualStretchDist *= shellSide;
					break;
					
				}
				
				if (curMode == EDITMODES.Turn) {
					
					dragProgressAmt = actualStretchDist;
					
				} else {
					
					var stretchDir = actualStretchDist > 0 ? 1 : -1 ;
					
					var slowCurve = 0.01;//arbitrary slow curve, to keep it from shooting off
					var stretchExtent = 1.0;//arbitrary stretch extent (consider the 1-x case; KEEP IT ABOVE ZERO!!)
					var slowedStretchDist = 1-(1/((Math.abs(actualStretchDist)*slowCurve)+1));
					dragProgressAmt = slowedStretchDist*stretchDir*stretchExtent;
					
				}
				
				
			}
			function mousedownFunc(e){
				
				dragging = true;
				transformAxis = axis;
				dragProgressAmt = 0;
				
				//console.log("clicked on stretcher for "+axis+" axis, "+shellSide+" shellSide");
				
				refreshDragMtx();
				
				dragStartAmt = getRayAmt(e.ray);
				
				//console.log("dragStartAmt:",dragStartAmt);
				
				scene.addEventListener('cursorup',mouseupFunc);
				scene.addEventListener('cursormove',mousemoveDragFunc);
				
				scene.removeEventListener('cursormove',mousemoveHoverFunc);
				
				
				
				updateEnabledness();//to work around 'teleport on mouseup' altspace bug :(
				
				
				
				
				//currently only used for rotating cube
				if (curMode == EDITMODES.Turn) curDraggingUpdateFunc = updateCubeMidDrag;
				
				
			}
			
			mesh.addEventListener('cursordown',mousedownFunc);
			
			
			
			
			
			function mousemoveHoverFunc(e){
				getRayAmt(e.ray);//ignore result, just to get ui in place
			}
			
			function mouseoverFunc(e){
				
				cubeHovering = true;
				
				if (dragging) return;
				refreshDragMtx();//this is very redundant but I don't think it'll hurt anything
				getRayAmt(e.ray);//ignore result, just to get ui in place
				
				scene.addEventListener('cursormove',mousemoveHoverFunc);
				
			}
			function mouseoutFunc(e){
				
				cubeHovering = false;
				
				if (dragging) return;
				scene.remove(dragIndicatorPlane);
				scene.remove(rotIndicatorHolder);
				
				scene.removeEventListener('cursormove',mousemoveHoverFunc);
				
			}
			
			mesh.addEventListener('cursorenter',mouseoverFunc);
			mesh.addEventListener('cursorleave',mouseoutFunc);
			
		}
		
		
		var debugCol;
		switch(axis){
			case 'x':
				debugCol = 0xFF0000;
			break;
			case 'y':
				debugCol = 0x00FF00;
			break;
			case 'z':
				debugCol = 0x0000FF;
			break;
		}
		var myMat = clickCatcherMaterial;//new THREE.MeshBasicMaterial({color:debugCol,side:THREE.DoubleSide});//
		
		
		var mainSide = new THREE.Mesh(
			new THREE.PlaneGeometry(scaleCubeSize/0.75,scaleCubeSize/0.75),
			myMat.clone()
		);
		mainSide.rotation.copy(rot);
		mainSide.position.set(0,0,scaleCubeSize*0.5);
		mainSide.position.applyEuler(rot);
		cubeClickersHolder.add(mainSide);
		assignDragFunctions(mainSide,1);
		cubeClickCatcherPlanes.push(mainSide);
		
		
		var shellSide = new THREE.Mesh(
			new THREE.PlaneGeometry(scaleCubeSize*cubeClickerShellMult/0.75,scaleCubeSize*cubeClickerShellMult/0.75),
			myMat.clone()
		);
		shellSide.rotation.copy(rot);
		shellSide.position.set(0,0,-scaleCubeSize*0.5*cubeClickerShellMult);
		shellSide.position.applyEuler(rot);
		cubeClickersHolder.add(shellSide);
		assignDragFunctions(shellSide,-1);
		cubeClickCatcherPlanes.push(shellSide);
		
		
		
	}
	for(var side=0; side<4; side++){
		makeSide(
			new THREE.Euler(0,side*Math.PI/2,0),
			(side%2)?'x':'z',
			(Math.floor(side/2)-0.5)*-2
		);
	}
	for(var top=0; top<2; top++){//and bottom
		makeSide(
			new THREE.Euler(Math.PI*(top-0.5),0,0),
			'y',
			(top-0.5)*-2
		);
	}
	
	
	
	
	
	
	
	var cursorIsDown = false;
	var cursorWasDown = false;
	var lastRay;
	var lastPos;
	var lastQuat;
	var lastUnit;
	var primMidpoint;
	function cursorUpFunc(e){
		cursorIsDown = false;
		lastPos = false;
	}
	function cursorDownFunc(e){
		if (e.target.UIBUTTON) {//paletteIconEl.object3D.children[0]) {
			//console.log("DRAWING CANCELLED BY PALETTE ICON CLICK");
			return;
		}
		cursorIsDown = true;
	}
	function cursorMoveFunc(e){
		lastRay = e.ray;
	}
	
	
	var forwardUnit = new THREE.Vector3(0,0,1);
	var upUnit = new THREE.Vector3(0,1,0);
	var zeroVec = new THREE.Vector3(0,0,0);
	
	
	var curMode;
	var curModeUsesClickCatcher;
	var effectivelyEnabled;
	var isOpen;
	
	
	
	function getCursorWorld(){
		return lastRay.at(2);
	}
	function lookAtQuat(gap,up){
		// okay this is HORRIBLY messy but it'll do!!
		var lookMtx = new THREE.Matrix4().lookAt(zeroVec,gap,up);
		var lookQuat = new THREE.Quaternion().setFromRotationMatrix(lookMtx);
		return lookQuat;
	}
	
	
	
	function updateEnabledness(){
		
		var effectivelyUsesClickCatcher = curModeUsesClickCatcher || (curMode == EDITMODES.Save && !selectionModeIsClick);
		effectivelyEnabled = enabled && isOpen && (effectivelyUsesClickCatcher || dragging);
		//console.log("cursor effectively enabled:",effectivelyEnabled);
		
		if (effectivelyEnabled) {
			scene.add(clickCatcherHolder);
			
			scene.addEventListener('cursorup',cursorUpFunc);
			scene.addEventListener('cursordown',cursorDownFunc);
			scene.addEventListener('cursormove',cursorMoveFunc);
		} else {
			scene.remove(clickCatcherHolder);
			
			scene.removeEventListener('cursorup',cursorUpFunc);
			scene.removeEventListener('cursordown',cursorDownFunc);
			scene.removeEventListener('cursormove',cursorMoveFunc);
		}
		
	}
	
	
	
	
	
	function updateCubePos(rotOnly){
		
		scene.add(scaleRefCube);
		
		if (!rotOnly) {
			var headYaw = getHeadYaw();
			var cubeDist = 1.0;
			scaleRefCube.position.set(
				headJoint.position.x + Math.sin(headYaw)*cubeDist,
				headJoint.position.y - 0.25,
				headJoint.position.z + Math.cos(headYaw)*cubeDist
			);
		}
		
		if (curMode == EDITMODES.Slide) {
			scaleRefCube.rotation.set(0,0,0);
		} else {
			var copyFrom = (selectedArtMesh.artType == ARTTYPES.mannequin) ? selectedArtMesh.myHolder : selectedArtMesh ;
			scaleRefCube.rotation.copy( copyFrom.rotation );
		}
		scaleRefCube.updateMatrix();
		
		if (selectedArtMesh.artType == ARTTYPES.costume) {
			selectedArtMesh.myMannequinMesh.myHolder.updateMatrix();//?
			scaleRefCube.quaternion.premultiply( selectedArtMesh.myMannequinMesh.myHolder.quaternion );
			scaleRefCube.updateMatrix();
		}
		
		cubeClickersHolder.matrix.identity();
		cubeClickersHolder.applyMatrix(scaleRefCube.matrix);
		scene.add(cubeClickersHolder);
		
	}
	
	var artWasSelected;
	function refreshArtSelected(){
		
		/*
		if (!artWasSelected) {
			if (selectedArtMesh) {
				updateCubePos();
				artWasSelected = true;
			}
		}
		*/
		
		if (selectedArtMesh) {
			updateCubePos();//on second thought just always move it into place, I guess?
		} else {
			hideCubeEverything();
		}
		
	}
	
	function hideCubeEverything(){
		scene.remove(scaleRefCube);
		scene.remove(cubeClickersHolder);
		scene.remove(dragIndicatorPlane);
		scene.remove(rotIndicatorHolder);
		dragging = false;
		cubeHovering = false;
	}
	
	
	return {
		
		label:"cursor",
		
		updateEnabledness:updateEnabledness,
		
		open:function(){
			
			cursorUpFunc();
			
			isOpen = true;
			updateEnabledness();
			
		},
		
		close:function(){
			
			isOpen = false;
			updateEnabledness();
			
		},
		
		modeSwitch:function(newMode){
			
			// closing:
			switch(curMode){
				case EDITMODES.Draw:
				case EDITMODES.Shape:
				case EDITMODES.Erase:
					
				break;
				case EDITMODES.Slide:
				case EDITMODES.Turn:
				case EDITMODES.Stretch:
					hideCubeEverything();
				break;
				case EDITMODES.Save:
				case EDITMODES.Load:
				case EDITMODES.Moderation:
				case EDITMODES.Disabled:
				
				break;
			}
			
			
			
			curMode = newMode;
			
			switch(newMode){
				case EDITMODES.Draw:
				case EDITMODES.Shape:
					curModeUsesClickCatcher = true;
				break;
				case EDITMODES.Erase:
				case EDITMODES.Slide:
				case EDITMODES.Turn:
				case EDITMODES.Stretch:
				case EDITMODES.Save:
				case EDITMODES.Load:
				case EDITMODES.Moderation:
				case EDITMODES.Disabled:
					curModeUsesClickCatcher = false;
				break;
			}
			
			updateEnabledness();
			
			
			
			
			// opening:
			switch(newMode){
				case EDITMODES.Draw:
					
				break;
				case EDITMODES.Shape:
					
				break;
				case EDITMODES.Erase:
					
				break;
				case EDITMODES.Slide:
				case EDITMODES.Turn:
				case EDITMODES.Stretch:
					artWasSelected = false;
					dragging = false;
				break;
				case EDITMODES.Save:
				case EDITMODES.Load:
				case EDITMODES.Moderation:
				case EDITMODES.Disabled:
				
				break;
			}
			
			
			
		},
		
		frameFunc:function(){
			
			if (effectivelyEnabled) {
				clickCatcherHolder.position.copy(headJoint.position);
			}
			
			switch(curMode){
				case EDITMODES.Draw:
					
				break;
				case EDITMODES.Shape:
					
				break;
				case EDITMODES.Erase:
					
				break;
				case EDITMODES.Slide:
				case EDITMODES.Turn:
				case EDITMODES.Stretch:
					
					for(var i=0; i<cubeClickCatcherPlanes.length; i++){
						var curCatcherPlane = cubeClickCatcherPlanes[i];
						var localHeadPos = headJoint.position.clone();
						
						localHeadPos.applyMatrix4( new THREE.Matrix4().getInverse(curCatcherPlane.matrixWorld) );//this can definitely be sped up but does it matter?
						curCatcherPlane.visible = localHeadPos.z > 0 ;
					}
					
				break;
				case EDITMODES.Save:
				case EDITMODES.Load:
				case EDITMODES.Moderation:
				case EDITMODES.Disabled:
				
				break;
			}
			
		},
		
		frameEnd:function(){//is this the only way to handle this??
			
			cursorWasDown = cursorIsDown;
			
		},
		
		getDominantPointing:function(){
			
			// this is now only ever called in 'draw' mode, for the moment
			
			var fingerPos;
			var fingerQuat = new THREE.Quaternion();
			
			// it seriously might make way more sense to send a ray rather than a position + quaternion...
			if (!cursorIsDown) return false;
			fingerPos = getCursorWorld();
			if (lastPos) {
				var gapVect = new THREE.Vector3().subVectors(fingerPos,lastPos);
				var lookQuat = lookAtQuat(gapVect,lastUnit);
				lastUnit = new THREE.Vector3(0,1,0).applyQuaternion(lookQuat);
				fingerQuat.setFromUnitVectors(lastUnit,upUnit);//up isn't used anyway; this definitely could be cleaned way way up
			} else {
				fingerQuat.setFromUnitVectors(forwardUnit,upUnit);
				lastUnit = upUnit.clone();
			}
			lastPos = fingerPos;
			lastQuat = fingerQuat;
			
			
			return {
				fingerPos:fingerPos,
				fingerQuat:fingerQuat
			};
			
		},
		
		getBothPinching:function(){
			
			if ( !(curMode == EDITMODES.Shape || curMode == EDITMODES.Save) ) return false;
			
			// moved cursorWasDown logic so other modes could use it too:
			
			if (!cursorIsDown) {
				//cursorWasDown = false;
				return false;
			}
			
			if (!cursorWasDown) {
				primMidpoint = getCursorWorld();
			}
			//cursorWasDown = true;
			
			
			var rightPt = getCursorWorld();
			if (rightPt.x == primMidpoint.x && rightPt.y == primMidpoint.y && rightPt.z == primMidpoint.z) {// to avoid 0,0,0 altspace error
				rightPt.x += 0.01;
			}
			var gapToMid = new THREE.Vector3().subVectors(rightPt,primMidpoint);
			var leftPt = new THREE.Vector3().subVectors(primMidpoint,gapToMid);
			
			var rightQuat = lookAtQuat(gapToMid,upUnit);
			gapToMid.negate();
			var leftQuat = lookAtQuat(gapToMid,upUnit);
			
			
			return {
				rightPinch:rightPt,
				leftPinch:leftPt,
				rightQuat:rightQuat,
				leftQuat:leftQuat,
				spawnMargin:0.05
			};
			
			
		},
		
		
		
		refreshArtSelected:refreshArtSelected,
		getIsStretching:function(){
			return dragging;
		},
		getTransformAxis:function(){
			return transformAxis;
		},
		getDragProgressAmt:function(){
			return dragProgressAmt;
		},
		
		
		selectedArtTransformed:function(){
			
			if (curDraggingUpdateFunc) curDraggingUpdateFunc();
			
		},
		
		
		strokeMinDist:0.02
		
		
	};
	
}

fileReady();
