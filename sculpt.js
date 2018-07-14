var controlSystems;
var curControlSystem;

var dominantHand, otherHand;

var scene;
var selectedArtMesh;

var SCULPT_handChoiceFunc;
var SCULPT_editModeFunc;
var SCULPT_nextShapeFunc;
var SCULPT_selectionMethodChangeFunc;

var SCULPT_deleteArtOfUserId;
var SCULPT_permissionChange;

var SCULPT_selectionFloodAll;
var SCULPT_selectionFloodNone;

var SCULPT_saveSelection;
var SCULPT_isAnythingSelected;

var selectionModeIsClick;

var presentPalette, hidePalette;

var artCountList;

var archiveArt, placePrint, deleteArchive;

var ARTTYPES = makeEnum('stroke','prim','print','mannequin','costume');
var PEDESTALBUTTON = makeEnum('Single','Left','Right');


var DEBUG_COLORBUCKETS = false;

var vertexCutoff = 0xFFFF;
var faceCutoff = vertexCutoff/3;

// in theory I could rewrite this to use BufferGeometries, and then use literal vertex count instead of faces*3 (which is very wasteful in this case)
// buuuuuut let's just keep it simple for now; the multi-mesh case is so rare that it isn't worth worrying about too much
// and the last thing I need right now is debugging a new format like that


function SETUP_sculpt(){
	
	
	
	
	
	
	var archiveFileFormat = [
		{
			name:"version",
			type:DATANUMTYPES.integer,
			count:DATACOUNT.single
		},
		{
			name:"offY",
			type:DATANUMTYPES.float,
			count:DATACOUNT.single
		},
		{
			name:"rad",
			type:DATANUMTYPES.float,
			count:DATACOUNT.single,
		},
		{
			name:"strokes",
			type:DATANUMTYPES.parent,
			count:DATACOUNT.array,
			child:[
				{
					name:"color",
					type:DATANUMTYPES.integer,
					count:DATACOUNT.single
				},
				{
					name:"transform",
					type:DATANUMTYPES.minimtx,
					count:DATACOUNT.single
				},
				{
					name:"vertices",
					type:DATANUMTYPES.triple,
					count:DATACOUNT.array
				}
			]
		},
		{
			name:"prims",
			type:DATANUMTYPES.parent,
			count:DATACOUNT.array,
			child:[
				{
					name:"color",
					type:DATANUMTYPES.integer,
					count:DATACOUNT.single
				},
				{
					name:"transform",
					type:DATANUMTYPES.minimtx,
					count:DATACOUNT.single
				},
				{
					name:"typeIndex",
					type:DATANUMTYPES.integer,
					count:DATACOUNT.single
				}
			]
		},
		{
			name:"prints",
			type:DATANUMTYPES.parent,
			count:DATACOUNT.array,
			child:[
				{
					name:"filename",
					type:DATANUMTYPES.string,
					count:DATACOUNT.single
				},
				{
					name:"transform",
					type:DATANUMTYPES.minimtx,
					count:DATACOUNT.single
				}
			]
		}
	];
	
	
	
	
	
	archiveArt = function(title,artSet,callback){
		
		
		
		var strokesList = [];
		var primsList = [];
		var printsList = [];
		
		artSet.forEach(function(curMesh){
			switch(curMesh.artType){
				case ARTTYPES.stroke:
					strokesList.push(curMesh);
				break;
				case ARTTYPES.prim:
					primsList.push(curMesh);
				break;
				case ARTTYPES.print:
					printsList.push(curMesh);
				break;
			}
		});
		
		
		
		
		var saveData = {
			version:1,
			strokes:[],
			prims:[],
			prints:[]
		};
		
		
		
		
		function makeCenterFinder(){
			
			var minVal;
			var maxVal;
			var firstPoint = true;
			
			function addPoint(v){
				if (firstPoint || (v < minVal)) minVal = v;
				if (firstPoint || (v > maxVal)) maxVal = v;
				firstPoint = false;
			}
			
			function getCenter(){
				return (minVal+maxVal)/2;
			}
			
			function getEdge(){
				var minEdge = minVal - getCenter();
				var maxEdge = maxVal - getCenter();
				return Math.max(Math.abs(minEdge),maxEdge);
			}
			
			return {
				addPoint:addPoint,
				getCenter:getCenter,
				getEdge:getEdge
			};
			
		}
		
		var midX = makeCenterFinder();
		var midY = makeCenterFinder();
		var midZ = makeCenterFinder();
		
		for(var strokeIndex=0; strokeIndex<strokesList.length; strokeIndex++){
			var curStrokeInfoSource = strokesList[strokeIndex];
			
			midX.addPoint(curStrokeInfoSource.lastServerTransInfo.p[0]);
			midY.addPoint(curStrokeInfoSource.lastServerTransInfo.p[1]);
			midZ.addPoint(curStrokeInfoSource.lastServerTransInfo.p[2]);
			// this isn't actually centered per se, but it's close enough to get a rough idea, which is all that's really needed tbh
			
		}
		
		for(var primIndex=0; primIndex<primsList.length; primIndex++){
			var curPrimInfoSource = primsList[primIndex];
			
			midX.addPoint(curPrimInfoSource.lastServerTransInfo.p[0]);
			midY.addPoint(curPrimInfoSource.lastServerTransInfo.p[1]);
			midZ.addPoint(curPrimInfoSource.lastServerTransInfo.p[2]);
			
		}
		
		for(var printIndex=0; printIndex<printsList.length; printIndex++){
			var curPrintInfoSource = printsList[printIndex];
			
			midX.addPoint(curPrintInfoSource.lastServerTransInfo.p[0]);
			midY.addPoint(curPrintInfoSource.lastServerTransInfo.p[1]);
			midZ.addPoint(curPrintInfoSource.lastServerTransInfo.p[2]);
			
		}
		
		var offX = midX.getCenter();
		var offY = midY.getCenter();
		var offZ = midZ.getCenter();
		
		var saveRelativeToHeadY = headJoint.position.y;
		saveData.offY = offY - saveRelativeToHeadY;
		
		//worst-case scenario (though doesn't include dimensions of objects, only a rough cloud of their origins...)
		saveData.rad = Math.max( midX.getEdge(), midY.getEdge(), midZ.getEdge() )/Math.cos(Math.PI/4);
		
		
		
		
		
		function makeCenteredTransform(sourceTransform){
			var offsettedTransform = {
				p:[],
				q:sourceTransform.q.slice(),
				s:sourceTransform.s.slice()
			};
			offsettedTransform.p[0] = sourceTransform.p[0]-offX;
			offsettedTransform.p[1] = sourceTransform.p[1]-offY;
			offsettedTransform.p[2] = sourceTransform.p[2]-offZ;
			return offsettedTransform;
		}
		
		
		
		for(var strokeIndex=0; strokeIndex<strokesList.length; strokeIndex++){
			
			var curStrokeInfoSource = strokesList[strokeIndex];
			
			var curStrokeInfoSave = {
				color: curStrokeInfoSource.color,
				transform: makeCenteredTransform(curStrokeInfoSource.lastServerTransInfo),
				vertices:[]
			};
			
			var vertexList = curStrokeInfoSource.geometry.vertices;//should be safe to read from mesh rather than stored server info, right?
			for(var vertexIndex=0; vertexIndex<vertexList.length; vertexIndex++){
				curStrokeInfoSave.vertices.push({
					x:vertexList[vertexIndex].x,
					y:vertexList[vertexIndex].y,
					z:vertexList[vertexIndex].z
				});
			}
			
			saveData.strokes.push(curStrokeInfoSave);
			
		}
		
		for(var primIndex=0; primIndex<primsList.length; primIndex++){
			
			var curPrimInfoSource = primsList[primIndex];
			
			var curPrimInfoSave = {
				color: curPrimInfoSource.color,
				transform: makeCenteredTransform(curPrimInfoSource.lastServerTransInfo),
				typeIndex: curPrimInfoSource.typeIndex
			}
			
			saveData.prims.push(curPrimInfoSave);
			
		}
		
		for(var printIndex=0; printIndex<printsList.length; printIndex++){
			
			var curPrintInfoSource = printsList[printIndex];
			
			var curPrintInfoSave = {
				filename: curPrintInfoSource.filename,
				transform: makeCenteredTransform(curPrintInfoSource.lastServerTransInfo)
			}
			
			saveData.prints.push(curPrintInfoSave);
			
		}
		
		
		
		var binaryArchive = packBinary(saveData,archiveFileFormat);
		
		/*
		console.log(saveData);
		var DEBUGunpacked = unpackBinary(binaryArchive,archiveFileFormat);
		console.log(DEBUGunpacked);
		*/
		
		
		var newFileInfoServer = myFilesServer.push();
		var newFileName = newFileInfoServer.key;
		var newFileRef = storageApp.child(newFileName);
		var newFileTask = newFileRef.put(new Uint8Array(binaryArchive));
		
		newFileTask.on('state_changed',function(snapshot){
			console.log(snapshot.bytesTransferred,"/",snapshot.totalBytes);
		},function(error){
			console.log("UPLOAD ERROR:",error);
			//callback();
		},function(){
			console.log("upload complete!!");
			newFileInfoServer.set({
				title:title,
				timestamp:Date.now()
			});
			callback(
				newFileInfoServer.key,
				{
					x:offX,
					y:offY,
					z:offZ
				}
			);
		});
		
		
		
	}
	
	var archiveCaches = new Map();
	var archiveCachesInProgress = new Map();
	function loadArchive(id,callback){
		
		if (archiveCaches.has(id)) {
			setTimeout(function(){
				callback(archiveCaches.get(id));
			},0);
			// logic is expecting callbacks, i.e. not returning immediately
			
		} else if (archiveCachesInProgress.has(id)) {
			archiveCachesInProgress.get(id).push(callback);
			
		} else {
			
			archiveCachesInProgress.set(id,[]);
			
			//timeLog("requesting archive url...");
			storageApp.child(id).getDownloadURL().then(function(url){
				
				var artXhr = new XMLHttpRequest();
				artXhr.responseType = "arraybuffer";
				artXhr.onload = function(e){
					
					//timeLog("binary transfer complete, beginning unpack...");
					var loadedData = unpackBinary(artXhr.response,archiveFileFormat);
					//timeLog("unpack complete, passing struct back to builder.");
					
					archiveCaches.set(id,loadedData);
					
					callback(loadedData);
					var otherCallbacks = archiveCachesInProgress.get(id);
					for(var i=0; i<otherCallbacks.length; i++) otherCallbacks[i](loadedData);
					archiveCachesInProgress.delete(id);
					
				}
				artXhr.open('GET',url);
				artXhr.send();
				//timeLog("archive url get, requesting binary transfer...");
				
			});
			
		}
		
	}
	deleteArchive = function(id,callback){
		
		// NOTE: the art data itself REMAINS ON THE SERVER, in case it's placed in the world anywhere.
		// I could make it delete itself from all rooms too, but this doesn't seem worth the trouble.
		// I've mainly added this feature so people's lists of art don't get cluttered, not for the server's sake.
		
		myFilesServer.child(id).set(null);
		if (callback) callback();//I'M NOT CURRENTLY ACTUALLY WAITING FOR THE SERVER TO NOTICE, because it doesn't really matter right now tbh
		
	}
	
	
	
	
	
	function iteratorToArray(iterator){
		var theArray = [];
		for(var entry of iterator){
			theArray.push(entry);
		}
		return theArray;
	}
	
	
	
	
	
	placePrint = function(id){
		
		//loading just to get at metadata, when we're about to load it again to display a moment later:
		//sounds wasteful for network but in practice will be cached
		loadArchive(id,function(loadedData){
			
			var spawnPt = headJoint.position.clone();
			
			var headVector = new THREE.Vector3(0,0,1);
			headVector.applyQuaternion(headJoint.quaternion);
			headVector.y = 0;
			headVector.normalize();
			headVector.multiplyScalar( 1.5+loadedData.rad );
			spawnPt.add(headVector);
			
			if (printLoadAsOptionInfo.getCurVal() == LOADAS.Art) {
				
				spawnPt.y = headJoint.position.y + loadedData.offY;
				
				placePrintOnServer(id,spawnPt);
				
			} else {
				
				myMannequinsServer.push({
					printFilename:id,
					bodypartIndex:costumeBodyPartOptionInfo.getCurVal().index,
					mannequinTransform:{
						p:[spawnPt.x,spawnPt.y,spawnPt.z],
						q:[0,0,0,1],
						s:[1,1,1]
					},
					costumeTransform:{
						p:[0,0,0],
						q:[0,0,0,1],
						s:[1,1,1]
					}
				});
				
			}
			
			
		});
		
	}
	
	
	function placePrintOnServer(id,spawnPt){
		myPrintsServer.push({
			filename:id,
			transform:{
				p:[spawnPt.x,spawnPt.y,spawnPt.z],
				q:[0,0,0,1],
				s:[1,1,1]
			},
			movingFinished:true
		});
	}
	
	
	function makeMtxFromMiniMtx(minimtx){
		
		return new THREE.Matrix4().compose(
			new THREE.Vector3(
				minimtx.p[0],
				minimtx.p[1],
				minimtx.p[2]
			),
			new THREE.Quaternion(
				minimtx.q[0],
				minimtx.q[1],
				minimtx.q[2],
				minimtx.q[3]
			),
			new THREE.Vector3(
				minimtx.s[0],
				minimtx.s[1],
				minimtx.s[2]
			)
		);
		
	}
	
	function makeServerTransformFromMtx(mtx){
		
		var newPos = new THREE.Vector3();
		var newRot = new THREE.Quaternion();
		var newScl = new THREE.Vector3();
		mtx.decompose(newPos,newRot,newScl);
		
		return {
			p:[newPos.x,newPos.y,newPos.z],
			q:[newRot.x,newRot.y,newRot.z,newRot.w],
			s:[newScl.x,newScl.y,newScl.z]
		};
		
	}
	
	function makePrintFromArchive(filename,finishedCallback,parentMtx,passedAddArtToFunc){
		
		loadArchive(filename,function(loadedData){
			
			var holder;
			var subMeshes;
			var addArtToFunc;
			
			if (!parentMtx) {//if 'root' call
				
				holder = new THREE.Object3D();
				subMeshes = [];
				
				addArtToFunc = function(mesh,curParentMtx){
					
					var newGeomFaces = mesh.geometry.faces.length;
					
					var existingMeshChoice;
					for(var subMeshIndex=0; subMeshIndex<subMeshes.length; subMeshIndex++){
						if ( (subMeshes[subMeshIndex].geometry.faces.length + newGeomFaces) < faceCutoff/2 ) {//half to allow for double-sided clickability
							existingMeshChoice = subMeshes[subMeshIndex];
							break;
						}
					}
					if (!existingMeshChoice) {
						existingMeshChoice = new THREE.Mesh(
							new THREE.Geometry(),
							ribbonMat.clone()//altspace bug
						);
						if (DEBUG_COLORBUCKETS) existingMeshChoice.material.color = new THREE.Color(debugColorsList[subMeshes.length%debugColorsList.length]);
						subMeshes.push(existingMeshChoice);
						holder.add(existingMeshChoice);
					}
					
					if (curParentMtx) mesh.applyMatrix(curParentMtx);
					
					existingMeshChoice.geometry.merge(mesh.geometry,mesh.matrix);
					
				}
				
			} else {
				addArtToFunc = passedAddArtToFunc;
			}
			
			
			
			
			for(var strokeIndex=0; strokeIndex<loadedData.strokes.length; strokeIndex++){
				var strokeInfo = loadedData.strokes[strokeIndex];
				
				var vertices = [];
				for(var vertIndex=0; vertIndex<strokeInfo.vertices.length; vertIndex+=2){
					vertices.push([
						strokeInfo.vertices[vertIndex],
						strokeInfo.vertices[vertIndex+1],
					]);
				}
				
				var strokeColor = new THREE.Color( DEBUG_COLORBUCKETS ? "#FFFFFF" : strokeInfo.color );
				var strokeMesh = new THREE.Mesh( makeCompleteStrokeGeom(vertices,strokeColor) );
				strokeMesh.applyMatrix(makeMtxFromMiniMtx(strokeInfo.transform));
				
				addArtToFunc(strokeMesh,parentMtx);
			}
			
			
			
			for(var primIndex=0; primIndex<loadedData.prims.length; primIndex++){
				var primInfo = loadedData.prims[primIndex];
				
				var primColor = new THREE.Color( DEBUG_COLORBUCKETS ? "#FFFFFF" : primInfo.color );
				var primMesh = new THREE.Mesh( makeCompletePrimGeom(primInfo.typeIndex, primColor) );
				primMesh.applyMatrix(makeMtxFromMiniMtx(primInfo.transform));
				
				addArtToFunc(primMesh,parentMtx);
			}
			
			
			
			
			
			var finishedPrints=0;
			function onePrintFinished(){
				finishedPrints++;
				checkIfAllPrintsFinished();
			}
			function checkIfAllPrintsFinished(){
				if (finishedPrints == loadedData.prints.length) {
					if (parentMtx) {
						finishedCallback();
					} else {
						
						for (var subMeshIndex=0; subMeshIndex<subMeshes.length; subMeshIndex++){
							var curSubMesh = subMeshes[subMeshIndex];
							curSubMesh.mergeGeom = curSubMesh.geometry.clone();
							curSubMesh.geometry.copy( createDoubleSidedGeomClone(curSubMesh.mergeGeom) );//not sure if you can just assign to geometry; playing it safe
							// note: I'm duplicating the primitives too even though they're already airtight, just because I can't be bothered doing that separately
							// (in theory I could build both meshes in addArtToFunc but frankly I'm not going to bother;
							// the real killer here is draw calls, not polycount)
						}
						
						//timeLog("print build finished!");
						finishedCallback(holder);
						
					}
				}
			}
			for(var printIndex=0; printIndex<loadedData.prints.length; printIndex++){
				var curPrintInfo = loadedData.prints[printIndex];
				var curMtx = makeMtxFromMiniMtx(curPrintInfo.transform);
				if (parentMtx) curMtx.multiply(parentMtx);
				makePrintFromArchive(
					curPrintInfo.filename,
					onePrintFinished,
					curMtx,
					addArtToFunc
				);
			}
			checkIfAllPrintsFinished();//do it once immediately, just in case there's zero prints
			
			
			
			
		});
		
	}
	
	
	
	
	
	
	
	
	
	var renderer = altspace.getThreeJSRenderer({initialSerializationBufferSize: 8500000});
	scene = new THREE.Scene();
	
	
	
	
	
	var debugColorsList = [
		0xFF0000,
		0xFFFF00,
		0x00FF00,
		0x00FFFF,
		0x0000FF,
		0xFF00FF
	];
	
	
	
	
	
	
	
	
	var editModeVal;
	
	
	
	
	function resizeDocumentToMetersWidth(w){
		var docMeters = 128;
		documentInfo.scale.set(w/docMeters,w/docMeters,w/docMeters);
	}
	
	
	
	
	
	
	function changeControlSystem(newControlSystem){
		if (curControlSystem) {
			console.log("] from "+curControlSystem.label+",");
			curControlSystem.close();
		}
		console.log("] switching to "+newControlSystem.label);
		curControlSystem = newControlSystem;
		curControlSystem.open();
		curControlSystem.modeSwitch(editModeVal);
		curControlSystem.frameFunc();
		
		stopAllInProgressDrawing();
		
		if (palette_refreshControlSystem) palette_refreshControlSystem();
		// the if statement is only for the initializing call, when the palette system hasn't initialized yet...
		// it's okay to miss it there, since it'll auto-call itself when the pallete system sets up...
		// this isn't a totally ideal way to do it, but it'll do?
	}
	
	
	
	var curPointsServer = null;
	var cubeInProgress = null;
	
	function endStrokeDrawing(deletedCurrentArt){
		
		if (curPointsServer) {
			
			var curDrawingFinishedServer = curPointsServer.parent.child('drawingFinished');
			if (!deletedCurrentArt) curDrawingFinishedServer.set(true);
			curDrawingFinishedServer.onDisconnect().cancel();
			
			curPointsServer = null;
			
		}
		
	}
	
	function endPrimDrawing(deletedCurrentArt){
		
		if (cubeInProgress) {
			
			var curCubeFinishedServer = cubeInProgress.child("movingFinished");
			if (!deletedCurrentArt) curCubeFinishedServer.set(true);
			curCubeFinishedServer.onDisconnect().cancel();
			
			cubeInProgress = null;
			
		}
		
	}
	
	function endSelection(deletedCurrentArt){
		
		if (selectedArtMesh) {
			
			markArtMovingFinished(selectedArtMesh,true,deletedCurrentArt);
			
			selectedArtMesh = null;
			
		}
		
		curControlSystem.refreshArtSelected();
		
	}
	
	function stopAllInProgressDrawing(deletedCurrentArt){
		
		console.log("resetting all drawing in progress...");
		
		endStrokeDrawing(deletedCurrentArt);
		endPrimDrawing(deletedCurrentArt);
		endSelection(deletedCurrentArt);
		
		if (SCULPT_selectionFloodNone) SCULPT_selectionFloodNone();//sigh
		
	}
	
	
	
	
	
	
	
	
	
	
	
	
	
	controlSystems = {
		cursor: SETUP_cursor(),
		tracked: SETUP_tracked()
	};
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	var paletteIconOpenTex = THREE.ImageUtils.loadTexture("popup_icon.png");
	var paletteIconCloseTex = THREE.ImageUtils.loadTexture("popup_icon_CLOSE.png");
	var paletteIconMat = new THREE.MeshBasicMaterial({map:paletteIconOpenTex,transparent:true});
	
	var paletteIconMesh = new THREE.Mesh(
		new THREE.PlaneGeometry(0.1,0.1),
		paletteIconMat
	);
	paletteIconMesh.position.set(
		0.15,
		0.6,
		-1.2
	);
	paletteIconMesh.rotation.set(
		-0.4,
		0.6,
		0,
		'ZYX'
	);
	paletteIconMesh.position.applyEuler(paletteIconMesh.rotation);
	new NativeComponent('n-cockpit-parent',null,paletteIconMesh).addTo(scene);
	paletteIconMesh.userData.altspace.collider.enabled = true;
	paletteIconMesh.addEventListener('cursordown',function(){
		//console.log("PALETTE ICON CLICKED...");
		if (paletteOpen) {
			hidePalette();
		} else {
			presentPalette();
		}
	});
	paletteIconMesh.name = "palette icon";
	paletteIconMesh.UIBUTTON = true;
	
	
	
	
	
	
	var removeAllCostumesButtonMesh = new THREE.Mesh(
		new THREE.PlaneGeometry(0.1,0.1),
		new THREE.MeshBasicMaterial({map:new THREE.ImageUtils.loadTexture("hangericon.png"),transparent:true})
	);
	removeAllCostumesButtonMesh.position.copy(paletteIconMesh.position);
	removeAllCostumesButtonMesh.rotation.copy(paletteIconMesh.rotation);
	var rightwards = new THREE.Vector3(0.15,0,0);
	rightwards.applyEuler(removeAllCostumesButtonMesh.rotation);
	removeAllCostumesButtonMesh.position.add(rightwards);
	new NativeComponent('n-cockpit-parent',null,removeAllCostumesButtonMesh).addTo(scene);
	removeAllCostumesButtonMesh.userData.altspace.collider.enabled = true;
	removeAllCostumesButtonMesh.addEventListener('cursordown',function(){
		personalWearingList.forEach(function(wearingInfo,wearingKey){ myWearingServer.child(wearingKey).remove(); });
		refreshPedestalButtons();
	});
	removeAllCostumesButtonMesh.visible = false;
	removeAllCostumesButtonMesh.UIBUTTON = true;
	function refreshRemoveAllCostumesButtonVisible(){
		removeAllCostumesButtonMesh.visible = !!personalWearingList.size;
	}
	
	
	
	
	var documentWorldSize = 2;
	var documentDistance = 1.5;
	
	var paletteHolder = new THREE.Object3D();
	scene.add(paletteHolder);
	paletteHolder.add(documentInfo);
	documentInfo.position.set(0,0,documentDistance);
	documentInfo.rotation.y = Math.PI;//for some reason!
	resizeDocumentToMetersWidth(documentWorldSize);
	/*
	for(var i=-1; i<=1; i+=2){
		var boxSize = 0.1;
		var debugPlane = new THREE.Mesh(
			new THREE.PlaneGeometry(boxSize,boxSize),
			new THREE.MeshBasicMaterial({color:0xFF00FF})
		);
		paletteHolder.add(debugPlane);
		debugPlane.position.set((documentWorldSize+boxSize)/2*i,(documentWorldSize+boxSize)/2*i*0.5825,documentDistance);
		debugPlane.rotation.y = Math.PI;
	}
	*/
	var bodyTag = document.getElementsByTagName("body")[0];
	
	var paletteOpen = false;
	presentPalette = function(){
		paletteHolder.position.copy(headJoint.position);
		paletteHolder.rotation.y = getHeadYaw();
		paletteIconMat.map = paletteIconCloseTex;
		paletteOpen = true;
		bodyTag.style.display = "block";
	}
	hidePalette = function(){
		paletteHolder.position.y = 1000000;
		paletteIconMat.map = paletteIconOpenTex;
		paletteOpen = false;
	}
	hidePalette();
	
	
	
	
	
	SCULPT_permissionChange = function(){
		
		paletteIconMesh.visible = permitted;
		
		if (permitted) {
			
		} else {
			hidePalette();
			stopAllInProgressDrawing();
		}
		
	}
	
	
	
	
	
	
	
	
	var bowlOuterGeom = new THREE.SphereGeometry(0.5,16,8,0,Math.PI*2,0,Math.PI/2);
	var bowlInnerGeom = new THREE.SphereGeometry(0.4,16,8,0,Math.PI*2,0,Math.PI/2);
	var bowlTopGeom = new THREE.RingGeometry(0.4,0.5,16,1);
	flipGeom(bowlInnerGeom);
	
	var bowlOuterMesh = new THREE.Mesh( bowlOuterGeom );
	var bowlInnerMesh = new THREE.Mesh( bowlInnerGeom );
	var bowlTopMesh = new THREE.Mesh( bowlTopGeom );
	bowlTopMesh.rotation.x = Math.PI/2;
	
	var bowlHolder = new THREE.Object3D();
	bowlHolder.add( bowlOuterMesh );
	bowlHolder.add( bowlInnerMesh );
	bowlHolder.add( bowlTopMesh );
	
	var bowlGeom = mergeObjects([bowlOuterMesh,bowlInnerMesh,bowlTopMesh],bowlHolder);
	
	
	
	var pyramidGeom = new THREE.CylinderGeometry(0,0.5,1,4,1,false,Math.PI/4);
	pyramidGeom.computeFlatVertexNormals();
	
	
	
	var donutThickness = 0.175;
	var ringThickness = 0.04;
	var pipeThickness = 0.1;
	
	var pipeSides = 12;
	var pipeBodyGeom = new THREE.TorusGeometry(0.5-pipeThickness,pipeThickness,pipeSides,pipeSides,Math.PI/2);
	var pipeCapGeom = new THREE.CircleGeometry(pipeThickness,pipeSides);
	
	var pipeBodyMesh = new THREE.Mesh( pipeBodyGeom );
	var pipeStartMesh = new THREE.Mesh( pipeCapGeom );
	var pipeEndMesh = new THREE.Mesh( pipeCapGeom );
	
	var pipeHolder = new THREE.Object3D();
	pipeHolder.add( pipeBodyMesh );
	pipeHolder.add( pipeStartMesh );
	pipeHolder.add( pipeEndMesh );
	
	pipeBodyMesh.rotation.y = Math.PI/2;
	pipeStartMesh.position.y = 0.5-pipeThickness;
	pipeEndMesh.position.z = -(0.5-pipeThickness);
	pipeEndMesh.rotation.x = Math.PI/2;
	
	var pipeGeom = mergeObjects([pipeBodyMesh,pipeStartMesh,pipeEndMesh],pipeHolder);
	
	
	
	
	var primGeoms = {};
	
	primGeoms[SHAPEMODES.Cube.index] = new THREE.BoxGeometry(1,1,1);
	primGeoms[SHAPEMODES.Ball.index] = new THREE.SphereGeometry(0.5,16,16);
	primGeoms[SHAPEMODES.Bowl.index] = bowlGeom;
	
	primGeoms[SHAPEMODES.Cylinder.index] = new THREE.CylinderGeometry(0.5,0.5,1,16,1);
	primGeoms[SHAPEMODES.Cone.index] = new THREE.CylinderGeometry(0,0.5,1,16,1);
	primGeoms[SHAPEMODES.Pyramid.index] = pyramidGeom;
	
	primGeoms[SHAPEMODES.Donut.index] = new THREE.TorusGeometry(0.5-donutThickness,donutThickness,12,20).rotateY(Math.PI/2);
	primGeoms[SHAPEMODES.Ring.index] = new THREE.TorusGeometry(0.5-ringThickness,ringThickness,6,24).rotateY(Math.PI/2);
	primGeoms[SHAPEMODES.Pipe.index] = pipeGeom;
	
	
	var virtualLightDir = new THREE.Vector3(1,2,3);
	virtualLightDir.normalize();
	
	function makePrimShader(baseColor){
		
		return function(pt,index,norm){
			var answerCol = baseColor.clone();
			var diffuseAmt = norm.dot(virtualLightDir) * 0.5 + 0.5;
			answerCol.multiplyScalar(1-diffuseAmt*0.3);
			return answerCol;
		}
		
	}
	
	
	
	
	
	
	
	
	
	
	
	
	
	function mannequinShadeLight(){ return new THREE.Color(0x888888); }
	function mannequinShadeDark(){ return new THREE.Color(0x666666); }
	
	
	// mannequin head
	
	var mannequinHeadHolder = new THREE.Object3D();
	var mannequinHeadParts = [];
	
	var mannequinHeadOffset = new THREE.Object3D();
	mannequinHeadOffset.position.set(0,-0.02,0.05);
	mannequinHeadHolder.add(mannequinHeadOffset);
	
	var mannequinHeadSkull = new THREE.Mesh( new THREE.SphereGeometry(0.2,8,6) );
	vertexShadeGeom(mannequinHeadSkull.geometry, mannequinShadeLight);
	mannequinHeadSkull.scale.set(0.7,1,0.6);
	mannequinHeadOffset.add(mannequinHeadSkull);
	mannequinHeadParts.push(mannequinHeadSkull);
	
	for(var i=-1; i<=1; i+=2){
		var mannequinHeadEye = new THREE.Mesh( new THREE.SphereGeometry(0.03,8,6) );
		vertexShadeGeom(mannequinHeadEye.geometry, mannequinShadeDark);
		mannequinHeadEye.position.set(0.04*i,0.03,-0.1);
		mannequinHeadOffset.add(mannequinHeadEye);
		mannequinHeadParts.push(mannequinHeadEye);
	}
	
	var mannequinHeadNose = new THREE.Mesh( new THREE.SphereGeometry(0.02,8,6) );
	vertexShadeGeom(mannequinHeadNose.geometry, mannequinShadeDark);
	mannequinHeadNose.position.set(0,-0.03,-0.1);
	mannequinHeadOffset.add(mannequinHeadNose);
	mannequinHeadParts.push(mannequinHeadNose);
	
	var mannequinHeadMouth = new THREE.Mesh( new THREE.SphereGeometry(0.005,8,6) );
	vertexShadeGeom(mannequinHeadMouth.geometry, mannequinShadeDark);
	mannequinHeadMouth.scale.set(5,1,3);
	mannequinHeadMouth.position.set(0,-0.07,-0.1);
	mannequinHeadOffset.add(mannequinHeadMouth);
	mannequinHeadParts.push(mannequinHeadMouth);
	
	var mannequinHeadGeom = mergeObjects(mannequinHeadParts,mannequinHeadHolder);
	/*
	new NativeComponent('n-skeleton-parent', {
		part:'head',
		side:'center',
		index:0,
		userId:'340097036898533524'
	}, new THREE.Mesh(mannequinHeadGeom,new THREE.MeshBasicMaterial())).addTo(scene);
	*/
	
	
	// mannequin body
	
	var mannequinBodyHolder = new THREE.Object3D();
	var mannequinBodyParts = [];
	
	var mannequinBodyOffset = new THREE.Object3D();
	mannequinBodyOffset.position.set(0,0.1,0);
	mannequinBodyHolder.add(mannequinBodyOffset);
	
	var mannequinBodyChest = new THREE.Mesh( new THREE.CylinderGeometry(0.2,0.2,0.6,8,1) );
	vertexShadeGeom( mannequinBodyChest.geometry, mannequinShadeLight );
	mannequinBodyChest.scale.set(0.8,0.95,0.5);
	mannequinBodyOffset.add(mannequinBodyChest);
	mannequinBodyParts.push(mannequinBodyChest);
	
	for(var i=-1; i<=1; i+=2){
		var mannequinBodyShoulder = new THREE.Mesh( new THREE.CylinderGeometry(0.05,0.05,0.2,8,1) );
		vertexShadeGeom( mannequinBodyShoulder.geometry, mannequinShadeDark );
		mannequinBodyShoulder.position.set(0.15*i,0.18,0);
		mannequinBodyShoulder.scale.set(2,1,1);
		mannequinBodyOffset.add(mannequinBodyShoulder);
		mannequinBodyParts.push(mannequinBodyShoulder);
	}
	
	var mannequinBodyPocket = new THREE.Mesh( new THREE.SphereGeometry(0.03,5,4,0,Math.PI,0,Math.PI/2) );
	vertexShadeGeom( mannequinBodyPocket.geometry, mannequinShadeDark );
	mannequinBodyPocket.position.set(-0.06,0.2,-0.08);
	mannequinBodyPocket.scale.set(1.5,2.2,0.5);
	mannequinBodyPocket.rotation.set(0,Math.PI,Math.PI);
	mannequinBodyOffset.add(mannequinBodyPocket);
	mannequinBodyParts.push(mannequinBodyPocket);
	
	var mannequinBodyGeom = mergeObjects(mannequinBodyParts,mannequinBodyHolder);
	/*
	new NativeComponent('n-skeleton-parent', {
		part:'spine',
		side:'center',
		index:0,
		userId:'340097036898533524'
	}, new THREE.Mesh(mannequinBodyGeom,new THREE.MeshBasicMaterial())).addTo(scene);
	*/
	
	
	// mannequin hand
	
	var mannequinHandHolder = new THREE.Object3D();
	var mannequinHandParts = [];
	
	var mannequinHandOffset = new THREE.Object3D();
	mannequinHandOffset.position.set(-0.01,0,-0.07);
	mannequinHandHolder.add(mannequinHandOffset);
	
	var mannequinHandPalm = new THREE.Mesh( new THREE.SphereGeometry(0.05,8,6) );
	vertexShadeGeom( mannequinHandPalm.geometry, mannequinShadeDark );
	mannequinHandPalm.scale.set(0.9,0.5,1);
	mannequinHandOffset.add(mannequinHandPalm);
	mannequinHandParts.push(mannequinHandPalm);
	
	var mannequinHandWrist = new THREE.Mesh( new THREE.CylinderGeometry(0.03,0.03,0.08,8,1) );
	vertexShadeGeom( mannequinHandWrist.geometry, mannequinShadeLight );
	mannequinHandWrist.rotation.set(Math.PI/2,0,0);
	mannequinHandWrist.position.set(0.005,-0.005,0.08);
	mannequinHandOffset.add(mannequinHandWrist);
	mannequinHandParts.push(mannequinHandWrist);
	
	var mannequinHandThumb = new THREE.Mesh( new THREE.CylinderGeometry(0.01,0.01,0.04,6,1) );
	vertexShadeGeom( mannequinHandThumb.geometry, mannequinShadeLight );
	mannequinHandThumb.rotation.set(Math.PI/2,0,0);
	mannequinHandThumb.position.set(-0.045,-0.015,-0.03);
	mannequinHandOffset.add(mannequinHandThumb);
	mannequinHandParts.push(mannequinHandThumb);
	
	for(var i=0; i<4; i++){
		var mannequinHandFingerHolder = new THREE.Object3D();
		mannequinHandFingerHolder.position.set(-0.025+i*0.02,0.01,-0.05);
		mannequinHandFingerHolder.rotation.set(-0.2,0,0);
		mannequinHandOffset.add(mannequinHandFingerHolder);
		
		var mannequinHandFinger = new THREE.Mesh( new THREE.CylinderGeometry(0.01,0.01,0.05,5,1) );
		vertexShadeGeom( mannequinHandFinger.geometry, mannequinShadeLight );
		mannequinHandFinger.rotation.set(Math.PI/2,0,0);
		mannequinHandFinger.position.set(0,0,-0.025);
		mannequinHandFingerHolder.add(mannequinHandFinger);
		mannequinHandParts.push(mannequinHandFinger);
	}
	
	var mannequinHandGeom = mergeObjects(mannequinHandParts,mannequinHandHolder);
	/*
	new NativeComponent('n-skeleton-parent', {
		part:'hand',
		side:'right',
		index:0,
		userId:'340097036898533524'
	}, new THREE.Mesh(mannequinHandGeom,new THREE.MeshBasicMaterial())).addTo(scene);
	*/
	
	
	var mannequinGeoms = [];
	mannequinGeoms[WEARON.Head.index] = mannequinHeadGeom;
	mannequinGeoms[WEARON.Body.index] = mannequinBodyGeom;
	mannequinGeoms[WEARON.Hand.index] = mannequinHandGeom;
	
	
	var pedestalOffsets = [];
	pedestalOffsets[WEARON.Head.index] = 0.25;
	pedestalOffsets[WEARON.Body.index] = 0.25;
	pedestalOffsets[WEARON.Hand.index] = 0.1;
	
	
	var genericPedestalGeom = new THREE.CylinderGeometry(0.25,0.2,0.1,16,1);
	genericPedestalGeom.translate(0,-0.05,0);
	vertexShadeGeom(genericPedestalGeom, makePrimShader(new THREE.Color(0x440088)) );
	genericPedestalGeom.rotateY(Math.PI);//shading doesn't look as good on the side that's always turning to face the user, heh
	var pedestalGeoms = [];
	pedestalGeoms[WEARON.Head.index] = genericPedestalGeom;
	pedestalGeoms[WEARON.Body.index] = genericPedestalGeom;
	pedestalGeoms[WEARON.Hand.index] = genericPedestalGeom;
	
	
	
	var genericPedestalButtonGeom = new THREE.PlaneGeometry(0.2,0.1);
	genericPedestalButtonGeom.translate(0,-0.05,0);
	genericPedestalButtonGeom.rotateX(-Math.PI/8);
	genericPedestalButtonGeom.translate(0,0,0.3);
	var pedestalButtonGeoms = [];
	pedestalButtonGeoms[PEDESTALBUTTON.Single.index] = genericPedestalButtonGeom;
	pedestalButtonGeoms[PEDESTALBUTTON.Left.index  ] = genericPedestalButtonGeom;
	pedestalButtonGeoms[PEDESTALBUTTON.Right.index ] = genericPedestalButtonGeom;
	
	
	
	var pedestalButtonTexes = [];
	pedestalButtonTexes[PEDESTALBUTTON.Single.index] = THREE.ImageUtils.loadTexture("btn_wearcostume.png");
	pedestalButtonTexes[PEDESTALBUTTON.Left.index  ] = THREE.ImageUtils.loadTexture("btn_lefthand.png");
	pedestalButtonTexes[PEDESTALBUTTON.Right.index ] = THREE.ImageUtils.loadTexture("btn_righthand.png");
	var pedestalButtonRemoveTex = THREE.ImageUtils.loadTexture("btn_removecostume.png");
	
	var pedestalButtonSides = [];
	pedestalButtonSides[PEDESTALBUTTON.Single.index] = 0;
	pedestalButtonSides[PEDESTALBUTTON.Left.index  ] = -1;
	pedestalButtonSides[PEDESTALBUTTON.Right.index ] = 1;
	
	
	
	
	
	
	
	
	
	
	
	
	var ribbonMat = new THREE.MeshBasicMaterial({
		side:THREE.DoubleSide,
		vertexColors: THREE.VertexColors
	});
	// ok so at the moment:
	// clickable (non-bucketed) meshes are double-sided geometry for the sake of click-catching
	// in-progress and bucket-merged meshes are single-sided for the sake of faster geometry creation
	// prims are one-sided but they're also closed which means a double-sided mat is a bit wasted on them, but who cares, overdraw isn't too killer
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	var allMannequinsLists = [];
	
	
	
	
	
	
	
	function removeFromArray(item,array){
		array.splice( array.indexOf(item), 1 );
	}
	
	
	function isKeySelected(key){
		if (!selectedArtMesh) return false;
		return (selectedArtMesh.key == key);
	}
	
	
	
	function makeTintColor(realColor){
		var tintColor = realColor.clone();
		tintColor.multiplyScalar(0xA/0xF);
		return tintColor;
	}
	function makeCompleteStrokeGeom(vertexPairs,realColor){
		
		var tintColor = makeTintColor(realColor);
		
		var oneSidedGeom = new THREE.Geometry();
		var pairCount = 0;
		for(var pairCount=0; pairCount<vertexPairs.length; pairCount++){
			
			var vertices = vertexPairs[pairCount];
			for(var vertexIndex=0; vertexIndex<2; vertexIndex++) {
				oneSidedGeom.vertices.push( new THREE.Vector3().copy(vertices[vertexIndex]) );
			}
			
			if (pairCount) {
				
				var faceStart = (pairCount-1)*2;
				
				var faceA = new THREE.Face3(
					faceStart + 0,
					faceStart + 1,
					faceStart + 2
				);
				var faceB = new THREE.Face3(
					faceStart + 2,
					faceStart + 1,
					faceStart + 3
				);
				
				faceA.vertexColors[0] = realColor;
				faceA.vertexColors[1] = tintColor;
				faceA.vertexColors[2] = realColor;
				
				faceB.vertexColors[0] = realColor;
				faceB.vertexColors[1] = tintColor;
				faceB.vertexColors[2] = tintColor;
				
				oneSidedGeom.faces.push(faceA,faceB);
				
			}
			
		};
		oneSidedGeom.computeVertexNormals();//?
		
		return oneSidedGeom;
		
	}
	function makeCompletePrimGeom(typeIndex,realColor){
		var myGeom = primGeoms[typeIndex].clone();
		vertexShadeGeom(myGeom,makePrimShader(realColor));
		return myGeom;
	}
	
	
	
	// when adding a listener to JUST the transform property of something,
	// the usual "this property always exists" check isn't reliable,
	// because there's no single property that's guaranteed to not be updating live, unfortunately.
	// but a check for none of the three properties being missing is enough to keep a transform apply from failing.
	// (should this just be INSIDE applyTransformFromServer, or is that wasteful for most cases?)
	function transformAloneWalkingDeadTest(newVal){
		if (newVal === null) return true;//stroke's just been deleted
		if ( (!newVal.p) || (!newVal.q ) || (!newVal.s) ) return true;//stroke is walking dead, but received a late update to only one prop
		// NOTE, Grab could return late for ALL properties, but hopefully that won't cause an error that would throw anything off...
		return false;
	}
	
	
	
	var personalWearingList;
	
	function isWearingThatCostumeThere(printFilename,bodypartIndex,sideIndex,deleteIfSo){
		var isIndeed = false;
		if (personalWearingList) {//some checks happen before setup, but that means I'm not wearing anything anyway so there's no reason to search
			personalWearingList.forEach(function(wearingInfo,wearingKey){
				if (wearingInfo.sourceInfo.printFilename != printFilename) return;
				if (wearingInfo.sourceInfo.where != bodypartIndex) return;
				if ((wearingInfo.sourceInfo.where == WEARON.Hand.index) && (wearingInfo.sourceInfo.side != sideIndex)) return;
				isIndeed = true;
				if (deleteIfSo) myWearingServer.child(wearingKey).remove();
			});
		}
		return isIndeed;
	}
	
	function pedestalTypeIndexToSideIndex(pedestalTypeIndex){//maybe I should just add 'center' to side options?
		switch(pedestalTypeIndex){
			case PEDESTALBUTTON.Left.index:
				return WEARSIDE.Left.index;
			break;
			case PEDESTALBUTTON.Right.index:
				return WEARSIDE.Right.index;
			break;
		}
	}
	
	function refreshPedestalButtons(){
		for(var mannequinsListIndex=0; mannequinsListIndex<allMannequinsLists.length; mannequinsListIndex++){
			allMannequinsLists[mannequinsListIndex].forEach(function(mannequinMesh,mannequinKey){
				for(var i=0; i<mannequinMesh.pedestalButtons.length; i++){
					var curPedestalButton = mannequinMesh.pedestalButtons[i];
					var pedestalSideIndex = pedestalTypeIndexToSideIndex(curPedestalButton.pedestalTypeIndex);
					var alreadyWearing = isWearingThatCostumeThere( mannequinMesh.myPrintFilename, mannequinMesh.myBodypartIndex, pedestalSideIndex );
					curPedestalButton.material.map = alreadyWearing ? pedestalButtonRemoveTex : pedestalButtonTexes[curPedestalButton.pedestalTypeIndex] ;
				}
			});
		}
	}
	
	
	
	
	var costumeButtonHoverOnColor = new THREE.Color(0xFFFFFF);
	var costumeButtonHoverOffColor = new THREE.Color(0xCCCCCC);
	
	
	artCountList = new Map();
	var userArtVisibilityToggles = new Map();
	
	
	var myAllBucketsMode;
	
	var usersServer = syncInstance.child('art').child('users');
	usersServer.on("child_added",function(snapshot,prevChildKey){
		
		
		var myUserId = snapshot.key;
		var isMe = myUserId == userInfo.userId;
		
		
		
		var myArtCountInfo = {
			strokeCount:0,
			nick:snapshot.val().nick
			//I am 99% certain that the first thing done in any child of 'users' will be assigning the nick,
			//and so it'll always be the moment that sends a child_added?
		};
		artCountList.set(myUserId,myArtCountInfo);
		
		function refreshMyArtCount(){
			
			//only during setup, which would still be zero anyway
			if (!myStrokesList) return;
			if (!myPrimsList) return;
			if (!myPrintsList) return;
			if (!myMannequinsList) return;
			
			//I know it says strokeCount but for these purposes it's everything
			myArtCountInfo.strokeCount = myStrokesList.size + myPrimsList.size + myPrintsList.size + myMannequinsList.size;
			if (palette_refreshArtCount) palette_refreshArtCount();//I'm not even sure why it's being called before the function's ready any more
			
		}
		
		
		
		
		function callOnEveryArt(func,individualMeshesAndMannequins){
			
			if (!myPrimsList) return;//ugh
			
			myStrokesList.forEach(function(curStroke,strokeKey){ if (curStroke.strokeFinished) func(curStroke); });
			
			myPrimsList.forEach(function(curPrim,primKey){ func(curPrim); });
			
			if (individualMeshesAndMannequins) {
				
				myPrintsList.forEach(function(curPrint,printKey){
					for(var childIndex=0; childIndex<curPrint.children.length; childIndex++){
						func(curPrint.children[childIndex]);
					}
				});
				
				myMannequinsList.forEach(function(curMannequin,mannequinKey){
					
					func(curMannequin);
					
					if (curMannequin.myCostumeMesh) {//the function will be re-called automatically once it's eventually added
						for(var childIndex=0; childIndex<curMannequin.myCostumeMesh.children.length; childIndex++){
							func(curMannequin.myCostumeMesh.children[childIndex]);
						}
					}
					
				});
				
			} else {
				
				myPrintsList.forEach(function(curPrint,printKey){ func(curPrint); });
				
			}
			
		}
		//just by fluke, anything calling holders also shouldn't touch mannequins;
		//this isn't necessarily the case on a conceptual level though, so this might need more granularity at some point
		function callOnEveryArtMesh(func){ callOnEveryArt(func,true); }
		function callOnEveryArtHolder(func){ callOnEveryArt(func,false); }
		if (isMe) {
			personalCallOnEveryArtMesh = callOnEveryArtMesh;
			personalCallOnEveryArtHolder = callOnEveryArtHolder;
		}
		everyoneCallOnEveryArtMeshFuncs.set(myUserId,callOnEveryArtMesh);
		everyoneCallOnEveryArtHolderFuncs.set(myUserId,callOnEveryArtHolder);
		
		
		var userArtVisible = true;
		userArtVisibilityToggles.set(myUserId,function(newVisibility){
			if (newVisibility != userArtVisible) {
				
				userArtVisible = newVisibility;
				
				potentiallyRefreshBuckets();//will mostly ignore the buckets thanks to dirty flag, but will still call refreshBucketMode (where visibilty is set)
				
				// also do the non-bucketed (i.e. mid-edit) stuff:
				callOnEveryArtMesh(function(artMesh){
					if (!artMesh.myBucket) artMesh.visible = userArtVisible;
				});
				
			}
		});
		
		
		
		
		
		
		
		// little note to self: the buckets currently don't consider spatial grouping,
		// other than in the inherent likeliness (but far from guarantee) that users will put subsequent strokes nearby.
		// this could affect object-level culling going on in Unity;
		// but given how cheap these triangles are to draw other than their draw calls, it's not likely to be a major issue
		
		var buckets = [];
		var bucketsEnabled = true;
		
		function allBucketsMode(newMode){
			//console.log("-------- main buckets enabled:",newMode);
			bucketsEnabled = newMode;
			potentiallyRefreshBuckets();
		}
		if (isMe) myAllBucketsMode = allBucketsMode;
		
		function newBucket(){
			var newBucket = {
				meshes:[],
				full:false,
				faceCount:0,
				mergedMesh:null
			};
			newBucket.refreshBucketMode = function(){
				
				var bucketEnabled = bucketsEnabled && newBucket.full;
				var bucketContentsVisible = userArtVisible;
				
				if (newBucket.mergedMesh) newBucket.mergedMesh.visible = bucketEnabled && bucketContentsVisible;
				for(var meshIndex=0; meshIndex<newBucket.meshes.length; meshIndex++) newBucket.meshes[meshIndex].visible = (!bucketEnabled) && bucketContentsVisible;
				
			}
			newBucket.updateFullness = function(){
				
				newBucket.full = false;
				
				
				if (newBucket.meshes.length >= 10) newBucket.full = true;//arbitrary; tune this!
				// (high enough to keep drawcount low, low enough to avoid hitches on merging)
				// higher than maximum should be impossible; the bucket should become marked as full immediately.
				// (if bucketsEnabled is false it won't, but drawing should be impossible while that mode is activated; it's only meant for deletion!)
				
				if (newBucket.faceCount > faceCutoff*0.9) newBucket.full = true;
				
			}
			
			buckets.push(newBucket);
			return newBucket;
		}
		
		function potentiallyRefreshBuckets(){
			
			// should bucket contents cascade down, between two both-non-full buckets??
			// it's hard to generalize things like this, but I think there's a decent chance it won't increase merges MOST of the time,
			// and it will also lower drawcalls MOST of the time.
			// I haven't implemented it yet because it's relatively rare to even occur at all,
			// and fitting it into this loop isn't the simplest thing, so never mind for the moment...
			
			for(var bucketIndex=0; bucketIndex<buckets.length; bucketIndex++){
				var curBucket = buckets[bucketIndex];
				
				if (bucketsEnabled && curBucket.dirty) {
					
					if (curBucket.mergedMesh) {
						scene.remove(curBucket.mergedMesh);//this will trigger the un-restorable bug, but that should be desired here anyway...
						curBucket.mergedMesh = null;
					}
					
					if (curBucket.full) {
						var DEBUGribbonMat = ribbonMat.clone();//altspace bug
						if (DEBUG_COLORBUCKETS) DEBUGribbonMat.color = new THREE.Color(debugColorsList[bucketIndex%debugColorsList.length]);
						curBucket.mergedMesh = mergeObjects(curBucket.meshes,scene,DEBUGribbonMat,true);
						//scene.add(curBucket.mergedMesh) happens inside mergeObjects, for reference
						//also so does the hiding of the contents of curBucket.meshes
					}
					
					curBucket.dirty = false;
					
				}
				
				curBucket.refreshBucketMode();
				
			}
			
		}
		function addArt(newMesh){
			
			// so, here's the thing about this facecount system.
			// the "full" designation is for locking something that you've decided is better off never having anything more added to it.
			// (this has to be decided in advance, since you can't go over, and when else would you get around to it.)
			// this is an easy choice to make in the case of the 10-object limit (if only because it's an arbitrary heuristic in the first place)
			// but the polycount limit is a HARD limit...
			// and that's mostly okay because this search will never add more than a bucket can handle according to that limit;
			// but it means that a bucket full of slightly less than the cutoff fraction of the face limit's worth of prints won't get locked
			// if you start adding very large ones from then on.
			// but.... really, that's fine; it's a similar problem to the "buckets with partly erased contents stay unlocked until you draw more" issue.
			// if this turns out to be the cause of excessive draw calls,
			// then it would probably be worth it to make the buckets cascade:
			// that would mean a slightly bigger re-transfer delay whenever erasing,
			// but it would actually mean LESS re-transfer delays on subsequent drawing,
			// as well as of course more efficient use of buckets so less draw calls.
			// (re-transfer delays don't cause VR hitching, right??)
			
			function addIndividualMesh(newMesh){
				
				var bucketChoice;
				for(var bucketIndex=0; bucketIndex<buckets.length; bucketIndex++){
					var curBucket = buckets[bucketIndex];
					if (!curBucket.full) {
						bucketChoice = curBucket;
						break;
					}
				}
				if (!bucketChoice) bucketChoice = newBucket();
				
				bucketChoice.meshes.push(newMesh);
				newMesh.myBucket = bucketChoice;
				if (!newMesh.parent) scene.add(newMesh);
				bucketChoice.faceCount += newMesh.geometry.faces.length;
				bucketChoice.dirty = true;
				bucketChoice.updateFullness();
				
			}
			
			if (newMesh.artType == ARTTYPES.print) {
				for(var childIndex=0; childIndex<newMesh.children.length; childIndex++){
					addIndividualMesh(newMesh.children[childIndex]);
				}
			} else {
				addIndividualMesh(newMesh);
			}
			
			potentiallyRefreshBuckets();
			
		}
		
		function removeArt(theMesh){
			unbucketArt(theMesh,true);
		}
		function unbucketArt(theMesh,alsoDelete){
			
			function removeIndividualMesh(theMesh){
				
				var fromBucket = theMesh.myBucket;
				if (fromBucket) {//in-progress prims won't have a bucket on deletion
					removeFromArray(theMesh,fromBucket.meshes);
					theMesh.myBucket = null;
					theMesh.visible = true;
					fromBucket.faceCount -= theMesh.geometry.faces.length;
					fromBucket.dirty = true;
					fromBucket.updateFullness();
				}
				
				if (alsoDelete) theMesh.parent.remove(theMesh);
				
			}
			
			if (theMesh.artType == ARTTYPES.print) {
				for(var childIndex=theMesh.children.length-1; childIndex>=0; childIndex--){
					removeIndividualMesh(theMesh.children[childIndex]);
				}
			} else {
				removeIndividualMesh(theMesh);
			}
			
			potentiallyRefreshBuckets();
			
		}
		
		
		
		
		
		
		
		function applyTransformFromServer(potentialMesh,transInfo){
			
			var mesh = (potentialMesh.artType == ARTTYPES.mannequin) ? potentialMesh.myHolder : potentialMesh ;
			
			mesh.position.set(
				transInfo.p[0],
				transInfo.p[1],
				transInfo.p[2]
			);
			mesh.scale.set(
				transInfo.s[0],
				transInfo.s[1],
				transInfo.s[2]
			);
			mesh.quaternion.set(
				transInfo.q[0],
				transInfo.q[1],
				transInfo.q[2],
				transInfo.q[3]
			);
			mesh.lastServerTransInfo = transInfo;//for simpler grab start lookup (and lots more at this point)
			
			if (isKeySelected(potentialMesh.key)) curControlSystem.selectedArtTransformed();
			
		}
		
		function updateArtMovementFinished(artMesh,newMovingFinished){
			
			if ( (!artMesh.wasMovingFinished) != (!newMovingFinished) ) {
				
				artMesh.wasMovingFinished = newMovingFinished;
				
				if (newMovingFinished) {
					addArt(artMesh);
				} else {
					unbucketArt(artMesh);
				}
				
			}
			
		}
		
		
		
		
		
		
		
		var myStrokesList = new Map();
		
		snapshot.ref.child("strokes").on("child_added",function(snapshot,prevChildKey){
			
			var strokeSource = snapshot.val();
			var strokeServer = snapshot.ref;
			var strokeKey = snapshot.key;
			
			
			if (!strokeSource.color && (strokeSource.color !== 0)) {// zero is a valid color! other falsy values aren't
				console.log("STROKE CREATED WITH NO COLOR -- must be walking dead from admin-deleted stroke in progress. deleting whole stroke all over again.");
				strokeServer.remove();
				return;
			}
			
			
			
			var strokePointsServer = strokeServer.child("points");
			var strokeDrawingFinishedServer = strokeServer.child("drawingFinished");
			var strokeColorServer = strokeServer.child("color");
			var DEBUG_hasStoppedListening = false;
			function stopListeningToCurStrokeProgress(){
				strokePointsServer.off("child_added");
				strokeDrawingFinishedServer.off("value");
				//strokeColorServer.off("value");//ON SECOND THOUGHT, leave that open so it can be useful for movements; just actually check whether it's still editing
				DEBUG_hasStoppedListening = true;
			}
			
			var strokeMovingFinishedServer = strokeServer.child("movingFinished");
			var strokeTransformServer = strokeServer.child("transform");
			function stopListeningToCurStrokeUpdates(){
				strokeMovingFinishedServer.off("value");
				strokeTransformServer.off("value");
			}
			
			
			
			
			
			
			
			
			
			
			var realColor = new THREE.Color( DEBUG_COLORBUCKETS ? 0xFFFFFF : strokeSource.color );
			var tintColor = makeTintColor(realColor);
			
			var curStrokeFinishedMesh = new THREE.Mesh();
			//this is the mesh that will EVENTUALLY be used, but we're not placing it yet;
			//just doing this for parity with how the rest of the lookups work,
			//since none of the lookups will involve meshes that aren't finished yet anyway.
			//though this will mean having to manually exclude entries that aren't finished yet from the forEach loops
			
			curStrokeFinishedMesh.stopListeningToCurStrokeProgress = stopListeningToCurStrokeProgress;
			curStrokeFinishedMesh.stopListeningToCurStrokeUpdates = stopListeningToCurStrokeUpdates;
			
			curStrokeFinishedMesh.artType = ARTTYPES.stroke;
			curStrokeFinishedMesh.key = strokeKey;
			myStrokesList.set(strokeKey, curStrokeFinishedMesh);
			refreshMyArtCount();
			
			curStrokeFinishedMesh.color = strokeSource.color;
			
			var progressHolder = new THREE.Object3D();
			scene.add(progressHolder);
			//other properties are always identity for in-progress strokes (FOR NOW):
			progressHolder.position.set(strokeSource.transform.p[0],strokeSource.transform.p[1],strokeSource.transform.p[2]);
			curStrokeFinishedMesh.progressHolder = progressHolder;
			
			
			//remaking it is a LITTLE redundant, esp. code-wise, but seems worth it for performance if it works the way I think it does
			//(see piecemeal construction below, code is VERY redundant!)
			function makeFinishedStroke(){
				
				strokePointsServer.once("value",function(finishedPointsSnapshot){
					
					var vertexPairs = [];
					finishedPointsSnapshot.forEach(function(pointSnapshot){ vertexPairs.push(pointSnapshot.val().vertices); });
					
					var oneSidedGeom = makeCompleteStrokeGeom(vertexPairs,realColor);
					var doubleSidedGeom = createDoubleSidedGeomClone(oneSidedGeom);
					
					//var doubleSidedMesh = new THREE.Mesh( doubleSidedGeom, ribbonMat.clone()/*altspace bug*/ );
					curStrokeFinishedMesh.geometry = doubleSidedGeom;
					curStrokeFinishedMesh.material = ribbonMat.clone();//altspace bug
					curStrokeFinishedMesh.position.copy(progressHolder.position);
					
					makeIntangible(curStrokeFinishedMesh);
					setArtMeshCursorHandlers(curStrokeFinishedMesh);
					
					curStrokeFinishedMesh.strokeFinished = true;
					curStrokeFinishedMesh.mergeGeom = oneSidedGeom;
					
					refreshClickability();//so things can be saved by someone who already has the save dialog open (shouldn't hurt performance much, hopefully?)
					
					//scene.add(oneSidedMesh);
					//addArt(oneSidedMesh);//DON'T add it here -- it's added when movingFinished is set to true (which is only listened for starting right after here)
					
					
					//console.log(">>>>> this stroke has now been flattened.");
					
					
					
					
					
					
					
					//once it's finished, start listening for subsequent transformation changes
					//(they should only be possible once it's finished anyway, but,
					//for the sake of already-finished stuff arriving from the server in a weird order,
					//let's just not listen until it's ready to be moved)
					
					strokeMovingFinishedServer.on("value",function(newSnapshot){
						
						var newVal = newSnapshot.val();
						if (newVal === null) return;//stroke's just been deleted
						
						updateArtMovementFinished(curStrokeFinishedMesh, newVal);
						
					});
					strokeTransformServer.on("value",function(newSnapshot){
						var newVal = newSnapshot.val();
						if (transformAloneWalkingDeadTest(newVal)) return;//dead or walking dead
						applyTransformFromServer(curStrokeFinishedMesh, newVal);
					});
					// it is silly to listen to both of these independently,
					// especially since it'll lead to some redundant changes,
					// but afaik that shouldn't break anything
					// so I'll leave it this way for now
					
					
					
					
					
				});
				
			}
			
			
			if (strokeSource.drawingFinished) {
				
				// IF IT WAS ALREADY FINISHED BY THE TIME I HEARD ABOUT IT
				
				// tcp SHOULD guarantee that all of the points will have already been sent if this is true, right??
				
				makeFinishedStroke();
				
			} else {
				
				// IF IT STARTED IN PROGRESS IN FRONT OF ME
				
				
				
				// in the meantime, draw it piecemeal until it's complete
				
				var lastPointKey = null;
				var lastPointInfo = null;
				strokePointsServer.on("child_added",function(strokePointSnapshot,prevChildKey){
					
					if (DEBUG_hasStoppedListening) console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! notified about stroke data after listening stopped!!!");
					
					var curPointInfo = strokePointSnapshot.val();
					
					if (lastPointKey) {
						
						if (prevChildKey != lastPointKey) console.log("on strokes: LAST CHILD KEY MISMATCH?????");
						
						var newGeom = new THREE.Geometry();
						newGeom.vertices.push(
							lastPointInfo.vertices[0], lastPointInfo.vertices[1],
							curPointInfo.vertices[0], curPointInfo.vertices[1]
						);
						
						var faceA = new THREE.Face3(0,1,2);
						var faceB = new THREE.Face3(2,1,3);
						
						faceA.vertexColors[0] = realColor;
						faceA.vertexColors[1] = tintColor;
						faceA.vertexColors[2] = realColor;
						
						faceB.vertexColors[0] = realColor;
						faceB.vertexColors[1] = tintColor;
						faceB.vertexColors[2] = tintColor;
						
						newGeom.faces.push( faceA, faceB );
						
						/*
						newGeom.faceVertexUvs = [[
							[new THREE.Vector2(0,0),new THREE.Vector2(0,1),new THREE.Vector2(1,0)],
							[new THREE.Vector2(1,0),new THREE.Vector2(0,1),new THREE.Vector2(1,1)]
						]];
						*/
						newGeom.computeVertexNormals();
						
						
						var DEBUGribbonMat = ribbonMat.clone();//altspace bug
						var newMesh = new THREE.Mesh( newGeom, DEBUGribbonMat );
						newMesh.name = "PROGRESS STROKE MESH";
						makeIntangible(newMesh);
						progressHolder.add(newMesh);
						//curStrokeInfo.progressMeshes.push(newMesh);
						/*
						if (isMe) {
							newMesh.boundBox = new THREE.Box3(new THREE.Vector3(0,0,0),new THREE.Vector3(1,1,1));
							newMesh.boundBox.setFromObject(newMesh);
						}
						*/
						
						//console.log("xxx IN-PROGRESS STROKE CHUNK ADDED TO "+strokeKey);
						
					}
					
					lastPointKey = strokePointSnapshot.key;
					lastPointInfo = curPointInfo;
					
				});
				
				
				
				// also, wait for the signal that it's over...
				strokeDrawingFinishedServer.on("value",function(finishedSnapshot){
					
					if (!finishedSnapshot.val()) return;//will likely get a call stating the existing 'false' value first
					
					//for(var i=0; i<curStrokeInfo.progressMeshes.length; i++) scene.remove(curStrokeInfo.progressMeshes[i]);
					scene.remove(progressHolder);
					
					// is this necessary? seems good to be conscientious & not leave dangling connections/listeners...
					stopListeningToCurStrokeProgress();
					
					//console.log(">>>> JUST HEARD THAT THIS IN-PROGRESS STROKE IS FINISHED");
					makeFinishedStroke();
					
				});
				
				
				
				if (isMe) {
					strokeColorServer.on("value",function(snapshot){
						if (!snapshot.val()) {//walking dead (or regular dead)
							console.log("a stroke of mine has just lost its color; unsure whether it's the one I'm currently editing or not");
							if ( (curPointsServer && (curPointsServer.parent.key == strokeKey)) || isKeySelected(strokeKey) ) {
								console.log("the color value, of a stroke of mine that's in progress, has disappeared; stopping my current drawing");
								stopAllInProgressDrawing(true);
							}
						}
					});
				}
				
				
				
				
			}
			
			
			
			
			
		});
		
		snapshot.ref.child("strokes").on("child_removed",function(deadSnapshot){
			
			//console.log("stroke child_removed.");
			
			var key = deadSnapshot.key;
			//if (curPointsServer) console.log("****************** STROKE DELETION:",curPointsServer.parent.key,"vs",key);
			if ( (curPointsServer && (curPointsServer.parent.key == key)) || isKeySelected(key) ) {
				console.log("received stroke-deletion message for THE STROKE THAT I'M EDITING! going to give up on editing it.");
				stopAllInProgressDrawing(true);
			}
			
			var curStrokeMesh = myStrokesList.get(key);
			if (!curStrokeMesh) {
				console.log("received stroke-deletion message for a stroke with no info; a walking dead must have just been aborted.");
				return;
			}
			
			
			
			
			
			myStrokesList.delete(key);
			refreshMyArtCount();
			
			console.log("GONNA DELETE A STROKE:");
			if (curStrokeMesh.strokeFinished) removeArt(curStrokeMesh);
			scene.remove(curStrokeMesh.progressHolder);
			
			
			// seems likely that the child being deleted from the server would shut these down automatically,
			// but let's be on the safe side I guess?
			curStrokeMesh.stopListeningToCurStrokeProgress();
			
			curStrokeMesh.stopListeningToCurStrokeUpdates();
			
			
		});
		
		
		
		
		var myPrimsList = new Map();
		
		function updateMovementAndFinished(mesh,snapshotVal){
			applyTransformFromServer(mesh,snapshotVal.transform);
			updateArtMovementFinished(mesh,snapshotVal.movingFinished);
		}
		
		snapshot.ref.child("prims").on("child_added",function(snapshot,prevChildKey){
			
			var primSource = snapshot.val();
			
			if (!primSource.color && (primSource.color !== 0)){// zero is a valid color! other falsy values aren't
				console.log("PRIM CREATED WITH NO COLOR -- must be walking dead from admin-deleted prim in progress. deleting whole prim all over again.");
				snapshot.ref.remove();
				return;
			}
			
			var realColor = new THREE.Color( DEBUG_COLORBUCKETS ? 0xFFFFFF : primSource.color );
			
			var myGeom = makeCompletePrimGeom(primSource.typeIndex,realColor);
			
			var DEBUGribbonMat = ribbonMat.clone();//altspace bug
			var primMesh = new THREE.Mesh(myGeom,DEBUGribbonMat);
			
			makeIntangible(primMesh);
			setArtMeshCursorHandlers(primMesh);
			primMesh.material.realColor = realColor;
			primMesh.color = primSource.color;//in case debug (maybe unnecessary..)
			primMesh.typeIndex = primSource.typeIndex;
			primMesh.name = "SOME PRIM";
			primMesh.key = snapshot.key;
			primMesh.artType = ARTTYPES.prim;
			scene.add(primMesh);
			
			myPrimsList.set(snapshot.key, primMesh);
			refreshMyArtCount();
			
			updateMovementAndFinished(primMesh,primSource);
			
		});
		
		
		snapshot.ref.child("prims").on("child_changed",function(snapshot,prevChildKey){
			
			var newVal = snapshot.val();
			var key = snapshot.key;
			
			if (!newVal.color && (newVal.color !== 0)) {// zero is a valid color! other falsy values aren't
				console.log("an updating prim lacks color; it must be walking dead. abandoning received changes");
				//if (cubeInProgress) console.log("^^^^^^^^^^^^^^^^^^^ PRIM CHANGE:",cubeInProgress.key,"vs",key);
				if ( (cubeInProgress && (cubeInProgress.key==key)) || isKeySelected(key) ) {
					console.log("also, this is the prim I'm currently controlling! Abandoning ongoing drawing");
					stopAllInProgressDrawing(true);
				}
				return;
			}
			updateMovementAndFinished(myPrimsList.get(key), newVal);
			
		});
		snapshot.ref.child("prims").on("child_removed",function(deadSnapshot){
			
			var key = deadSnapshot.key;
			//if (cubeInProgress) console.log("****************** PRIM DELETION:",cubeInProgress.key,"vs",key);
			if ( (cubeInProgress && (cubeInProgress.key == key)) || isKeySelected(key) ) {
				console.log("received prim-deletion message for THE PRIM THAT I'M EDITING! going to give up on editing it.");
				stopAllInProgressDrawing(true);
				// I possibly don't need to be testing on 'remove' AND on 'change color to null'? color-to-null at least though, because of walking dead
			}
			
			var curPrimInfo = myPrimsList.get(key);
			if (!curPrimInfo) {
				console.log("received prim-deletion message for a prim with no info; a walking dead must have just been aborted.");
				return;
			}
			
			removeArt(curPrimInfo);
			scene.remove(curPrimInfo);//usually redundant; only needed if it's admin-deleted during progress
			
			myPrimsList.delete(key);
			refreshMyArtCount();
			
		});
		
		
		
		
		var myPrintsList = new Map();
		
		snapshot.ref.child("prints").on("child_added",function(snapshot,prevChildKey){
			
			var printSource = snapshot.val();
			
			if (!printSource.filename) {
				console.log("PRINT CREATED WITH NO FILENAME -- must be walking dead from admin-deleted print in progress. deleting whole print all over again.");
				snapshot.ref.remove();
				return;
			}
			
			//timeLog("SOMEONE ADDED A NEW PRINT TO THE SCENE! starting timer...",true);
			makePrintFromArchive(printSource.filename,function(printMesh){
				
				for(var childIndex=0; childIndex<printMesh.children.length; childIndex++){
					var curChild = printMesh.children[childIndex];
					curChild.multipartParent = printMesh;
					makeIntangible(curChild);
					setArtMeshCursorHandlers(curChild);
				}
				
				printMesh.filename = printSource.filename;
				printMesh.key = snapshot.key;
				printMesh.artType = ARTTYPES.print;
				scene.add(printMesh);
				
				myPrintsList.set(snapshot.key, printMesh);
				refreshMyArtCount();
				refreshClickability();//right? I never noticed a bug here but it should affect this too...
				
				updateMovementAndFinished(printMesh,printSource);
				
			});
			
		});
		
		snapshot.ref.child("prints").on("child_changed",function(snapshot,prevChildKey){
			
			var newVal = snapshot.val();
			var key = snapshot.key;
			
			if (!newVal.filename) {
				console.log("an updating print lacks filename; it must be walking dead. abandoning received changes");
				if (isKeySelected(key)) {
					console.log("also, this is the print I'm currently controlling! abandoning ongoing drawing");
					stopAllInProgressDrawing(true);
				}
				return;
			}
			updateMovementAndFinished(myPrintsList.get(key), newVal);
			
		});
		
		snapshot.ref.child("prints").on("child_removed",function(deadSnapshot){
			
			var key = deadSnapshot.key;
			if (isKeySelected(key)){
				console.log("received print-deletion message for the print that I'm editing! going to give up on editing it.");
				stopAllInProgressDrawing(true);
			}
			
			var curPrintInfo = myPrintsList.get(key);
			if (!curPrintInfo){
				console.log("received print-deletion message for a print with no info; a walking dead must have just been aborted.");
				return;
			}
			
			removeArt(curPrintInfo);
			
			myPrintsList.delete(key);
			refreshMyArtCount();
			
		});
		
		
		
		
		
		var myMannequinsList = new Map();
		allMannequinsLists.push(myMannequinsList);
		
		snapshot.ref.child("mannequins").on("child_added",function(snapshot,prevChildKey){
			
			var mannequinSource = snapshot.val();
			var mannequinServer = snapshot.ref;
			var mannequinKey = snapshot.key;
			
			
			if (!mannequinSource.printFilename) {
				console.log("MANNEQUIN CREATED WITH NO PRINT -- must be walking dead from admin-deleted mannequin in progress. deleting whole thing all over again.");
				mannequinServer.remove();
				return;
			}
			
			
			var mannequinHolder = new THREE.Object3D();
			
			var mannequinMesh = new THREE.Mesh( mannequinGeoms[mannequinSource.bodypartIndex], new THREE.MeshBasicMaterial() );
			mannequinMesh.myHolder = mannequinHolder;
			mannequinMesh.myPrintFilename = mannequinSource.printFilename;
			mannequinMesh.myBodypartIndex = mannequinSource.bodypartIndex;
			mannequinHolder.add(mannequinMesh);
			makeIntangible(mannequinMesh);
			setArtMeshCursorHandlers(mannequinMesh);
			
			var pedestalFrame = new THREE.Mesh( pedestalGeoms[mannequinSource.bodypartIndex], new THREE.MeshBasicMaterial() );
			pedestalFrame.position.y = -pedestalOffsets[mannequinSource.bodypartIndex];
			makeIntangible(pedestalFrame);
			mannequinHolder.add(pedestalFrame);
			mannequinMesh.pedestalFrame = pedestalFrame;
			mannequinMesh.pedestalButtons = [];
			
			function makePedestalButton(pedestalButtonType,clickedFunc){
				var pedestalButtonMat = new THREE.MeshBasicMaterial({
					color:costumeButtonHoverOffColor
				});
				var pedestalButton = new THREE.Mesh(pedestalButtonGeoms[pedestalButtonType.index],pedestalButtonMat);
				pedestalButton.UIBUTTON = true;
				pedestalButton.position.x = 0.12 * pedestalButtonSides[pedestalButtonType.index];
				pedestalButton.addEventListener('cursordown',clickedFunc);
				pedestalButton.addEventListener('cursorenter',function(){pedestalButtonMat.color = costumeButtonHoverOnColor;});
				pedestalButton.addEventListener('cursorleave',function(){pedestalButtonMat.color = costumeButtonHoverOffColor;});
				pedestalFrame.add(pedestalButton);
				mannequinMesh.pedestalButtons.push(pedestalButton);
				pedestalButton.pedestalTypeIndex = pedestalButtonType.index;
			}
			
			function wearCostume(sideIndex){
				if (isWearingThatCostumeThere(mannequinSource.printFilename,mannequinSource.bodypartIndex,sideIndex,true)) {
					//delete happens inside search (since it's found it anyway)
				} else {
					var newWearing = myWearingServer.push({
						printFilename:mannequinSource.printFilename,
						where:mannequinSource.bodypartIndex,
						side:sideIndex,
						transform:mannequinMesh.myCostumeMesh.lastServerTransInfo
					});
					newWearing.onDisconnect().remove();
				}
				refreshPedestalButtons();
			}
			
			switch(mannequinSource.bodypartIndex){
				case WEARON.Head.index:
				case WEARON.Body.index:
					makePedestalButton(PEDESTALBUTTON.Single,function(){wearCostume(0)});
				break;
				case WEARON.Hand.index:
					makePedestalButton(PEDESTALBUTTON.Left,function(){wearCostume(WEARSIDE.Left.index)});
					makePedestalButton(PEDESTALBUTTON.Right,function(){wearCostume(WEARSIDE.Right.index)});
				break;
			}
			
			makePrintFromArchive(mannequinSource.printFilename,function(printMesh){
				
				for(var childIndex=0; childIndex<printMesh.children.length; childIndex++){
					var curChild = printMesh.children[childIndex];
					curChild.multipartParent = printMesh;
					makeIntangible(curChild);
					setArtMeshCursorHandlers(curChild);
				}
				
				printMesh.myMannequinMesh = mannequinMesh;
				printMesh.key = snapshot.key;//watch out!! this will collide with mannequin; sometimes that's good, other times check artType
				mannequinMesh.myCostumeMesh = printMesh;
				
				
				mannequinHolder.add(printMesh);
				printMesh.artType = ARTTYPES.costume;
				
				mannequinServer.child("costumeTransform").on("value",function(newSnapshot){
					var newVal = newSnapshot.val();
					if (transformAloneWalkingDeadTest(newVal)) return;//dead or walking dead
					applyTransformFromServer(printMesh, newVal);
				});
				
				refreshClickability();
				
			});
			
			
			scene.add(mannequinHolder);
			mannequinMesh.artType = ARTTYPES.mannequin;
			
			mannequinServer.child("mannequinTransform").on("value",function(newSnapshot){
				var newVal = newSnapshot.val();
				if (transformAloneWalkingDeadTest(newVal)) return;//dead or walking dead
				applyTransformFromServer(mannequinMesh, newVal);//pass mannequinmesh & let function find mannequinholder, for the sake of isKeySelected test
			});
			
			mannequinMesh.key = snapshot.key;
			myMannequinsList.set(snapshot.key, mannequinMesh);
			refreshMyArtCount();
			refreshPedestalButtons();
			
			
			
			if (isMe) {
				mannequinServer.child("printFilename").on("value",function(snapshot){
					if (!snapshot.val()) {
						if (isKeySelected(mannequinKey)) {//this will probably need tweaks
							console.log("the printFilename value, of a pedestal or costume of mine that I'm dragging, has disappeared; stopping my current drawing");
							stopAllInProgressDrawing(true);
						}
					}
				});
			}
			
			
		});
		
		snapshot.ref.child("mannequins").on("child_removed",function(deadSnapshot){
			
			var key = deadSnapshot.key;
			if (isKeySelected(key)){//this will probably need tweaks
				console.log("received mannequin-deletion message for the mannequin that I'm editing! going to give up on editing it.");
				stopAllInProgressDrawing(true);
			}
			
			var curMannequinMesh = myMannequinsList.get(key);
			if (!curMannequinMesh){
				console.log("received mannequin-deletion message for a mannequin with no info; a walking dead must have just been aborted.");
				return;
			}
			
			scene.remove(curMannequinMesh.myHolder);
			
			myMannequinsList.delete(key);
			refreshMyArtCount();
			
		});
		
		//initial stroke counts are going to come before prim server is set, so let's call it once after they've both been made just to straighten that out
		refreshMyArtCount();
		
		
		
		
		var myWearingList = new Map();
		if (isMe) personalWearingList = myWearingList;
		
		snapshot.ref.child("wearing").on("child_added",function(snapshot,prevChildKey){
			
			var wearingSource = snapshot.val();
			var wearingKey = snapshot.key;
			
			var wearingInfo = {
				sourceInfo:wearingSource,//this is safe, right?
				printChildComponents:[]
			};
			myWearingList.set(wearingKey,wearingInfo);
			refreshRemoveAllCostumesButtonVisible();
			
			makePrintFromArchive(wearingSource.printFilename,function(printMesh){
				
				if (!myWearingList.has(wearingKey)) return;//if I'm not in the array any more, then I was deleted before the load completed, so don't do anything
				
				
				var componentInfo;
				switch(wearingSource.where){
					case WEARON.Head.index:
						componentInfo = {
							part:'head',
							side:'center',
							index:0
						};
					break;
					case WEARON.Body.index:
						componentInfo = {
							part:'spine',
							side:'center',
							index:0
						}
					break;
					case WEARON.Hand.index:
						componentInfo = {
							part:'hand',
							side:((wearingSource.side==WEARSIDE.Right.index)?'right':'left'),
							index:0,
						}
					break;
				}
				componentInfo.userId = myUserId;
				
				var handFlipMtx = new THREE.Matrix4().makeScale(-1,1,1);
				
				for(var i=printMesh.children.length-1; i>=0; i--){
					
					var curMesh = printMesh.children[i];
					applyTransformFromServer(curMesh, wearingSource.transform);
					if (wearingSource.where == WEARON.Hand.index && wearingSource.side==WEARSIDE.Left.index) {
						curMesh.updateMatrix();//?
						curMesh.applyMatrix(handFlipMtx);
					}
					
					var curComponent = new NativeComponent('n-skeleton-parent', componentInfo, curMesh);
					curComponent.addTo(scene);
					wearingInfo.printChildComponents.push(curComponent);
					
				}
				
				
				
			});
			
		});
		
		snapshot.ref.child("wearing").on("child_removed",function(deadSnapshot){
			
			var key = deadSnapshot.key;
			
			// this MIGHT FIRE for prints whose loads are still in progress,
			// but, they have placeholder empty arrays, so it won't hurt anything here,
			// and the load completion checks if its key is still in the list or not before displaying
			var curWearingInfo = myWearingList.get(key);
			for(var i=0; i<curWearingInfo.printChildComponents.length; i++) curWearingInfo.printChildComponents[i].remove(true);
			myWearingList.delete(key);
			refreshRemoveAllCostumesButtonVisible();
			
		});
		
		
		
	});
	
	
	
	SCULPT_deleteArtOfUserId = function(userIdToErase){
		
		usersServer.child(userIdToErase).child("strokes").remove();
		usersServer.child(userIdToErase).child("prims").remove();
		usersServer.child(userIdToErase).child("prints").remove();
		usersServer.child(userIdToErase).child("mannequins").remove();
		// keep username around, as well as potential stuff like handedness, just in case this was a non-malicious clear
		
	}
	
	
	
	
	
	
	var myDrawingServer = usersServer.child(userInfo.userId);
	myDrawingServer.update({nick:userInfo.displayName});
	var myStrokesServer = myDrawingServer.child('strokes');
	var myPrimsServer = myDrawingServer.child('prims');
	var myPrintsServer = myDrawingServer.child('prints');
	var myMannequinsServer = myDrawingServer.child('mannequins');
	var myWearingServer = myDrawingServer.child("wearing");
	
	curPointsServer = null;
	var lastPos = null;
	
	cubeInProgress = null;
	
	
	
	var nextShapeVal = SHAPEMODES.Ball;
	SCULPT_nextShapeFunc = function(newVal){
		nextShapeVal = newVal;
	};
	
	
	
	
	
	editModeVal = EDITMODES.Draw;
	SCULPT_editModeFunc = function(newVal){
		
		
		
		
		
		editModeVal = newVal;
		
		
		
		stopAllInProgressDrawing();
		
		// I'm not nuts about calls coming in for this before everything's set up; this could stand to be untangled at some point
		if (curControlSystem) curControlSystem.modeSwitch(editModeVal);
		
		
		
		// buckets mode switch
		refreshClickability();
		
		
		
		//endSelection();//built into stopAllInProgressDrawing now
		
		
		
		
		
		
		// set up new stuff
		switch(editModeVal){
			case EDITMODES.Erase:
				cursorMeshPointHandler = eraseHoverHandler;
				cursorMeshClickHandler = eraseClickHandler;
			break;
			case EDITMODES.Grab:
			case EDITMODES.Slide:
			case EDITMODES.Turn:
			case EDITMODES.Stretch:
				cursorMeshPointHandler = transformHoverHandler;
				cursorMeshClickHandler = transformClickHandler;
			break;
			case EDITMODES.Save:
				cursorMeshPointHandler = saveHoverHandler;
				cursorMeshClickHandler = saveClickHandler;
			break;
		}
		
		
		
		
	};
	
	function refreshClickability(){
		if (!myAllBucketsMode) return;//if it's not set up yet, ugh
		
		
		var shouldAllBucketsMode;
		switch(editModeVal){
			case EDITMODES.Draw:
			case EDITMODES.Shape:
			case EDITMODES.Load:
			case EDITMODES.Moderation:
			case EDITMODES.Disabled:
				shouldAllBucketsMode = true;
			break;
			case EDITMODES.Erase:
			case EDITMODES.Grab:
			case EDITMODES.Slide:
			case EDITMODES.Turn:
			case EDITMODES.Stretch:
			case EDITMODES.Save:
				shouldAllBucketsMode = false;
			break;
		}
		myAllBucketsMode(shouldAllBucketsMode);
		
		var shouldClickable = !shouldAllBucketsMode;
		if (editModeVal == EDITMODES.Save) shouldClickable = selectionModeIsClick;
		setArtClickable(shouldClickable);
		
		
	}
	
	
	dominantHand = "Right";
	otherHand = "Left";
	SCULPT_handChoiceFunc = function(newVal){
		
		if (newVal == HANDEDNESSES.Left) {
			dominantHand = "Left";
			otherHand = "Right";
		} else {
			dominantHand = "Right";
			otherHand = "Left";
		}
		
	};
	
	
	
	
	var personalCallOnEveryArtMesh;
	var everyoneCallOnEveryArtMeshFuncs = new Map();
	function everyoneCallOnEveryArtMesh(func){
		everyoneCallOnEveryArtMeshFuncs.forEach(function(userFunc,userKey){ userFunc(func); });
	}
	
	var personalCallOnEveryArtHolder;
	var everyoneCallOnEveryArtHolderFuncs = new Map();
	function everyoneCallOnEveryArtHolder(func){
		everyoneCallOnEveryArtHolderFuncs.forEach(function(userFunc,userKey){ userFunc(func); });
	}
	
	var lastClickableWaveWasEveryone = false;
	
	var clickabilityDirtyMeshes = new Set();
	
	function setArtClickable(newState){
		
		function actuallySetClickable(forEveryone,newVal){
			
			function setMeshClickable(mesh){
				//BECAUSE OF A BUG, we're only going to flag it here; we'll only actually perform the change to match whatever the state is at the end of the frame
				clickabilityDirtyMeshes.add(mesh);
				mesh.newClickability = newVal;
			}
			
			if (forEveryone) {
				everyoneCallOnEveryArtMesh(setMeshClickable);
			} else {
				personalCallOnEveryArtMesh(setMeshClickable);
			}
			
		}
		
		var effectivelyClickEveryone = (editModeVal == EDITMODES.Save) && selectionWhoseIsEveryone;
		
		if (!effectivelyClickEveryone && lastClickableWaveWasEveryone) actuallySetClickable(true,false);
		actuallySetClickable(effectivelyClickEveryone,newState);
		// this will often involve redundant calls, but I don't think these calls take THAT long? could be worth investigating
		
		lastClickableWaveWasEveryone = effectivelyClickEveryone;
		
	}
	
	
	var cursorMeshPointHandler;
	var cursorMeshClickHandler;
	function setArtMeshCursorHandlers(mesh){
		
		// NOTE, these will throw errors if they're called with no handlers assigned of course;
		// but if anything that's good, because assignment and enabling should always be done together anyway...
		
		var artRoot = mesh.multipartParent ? mesh.multipartParent : mesh ;
		
		mesh.addEventListener('cursorenter',function(e){
			cursorMeshPointHandler(artRoot);
		});
		mesh.addEventListener('cursorleave',function(){
			cursorMeshPointHandler(null);
		});
		mesh.addEventListener('cursordown',function(){
			cursorMeshClickHandler(artRoot);
		});
		
	}
	
	
	
	
	
	function getMeshServer(artMesh){
		switch(artMesh.artType){
			case ARTTYPES.stroke:
				return myStrokesServer.child(artMesh.key);
			break;
			case ARTTYPES.prim:
				return myPrimsServer.child(artMesh.key);
			break;
			case ARTTYPES.print:
				return myPrintsServer.child(artMesh.key);
			break;
			case ARTTYPES.mannequin:
				return myMannequinsServer.child(artMesh.key);
			break;
			case ARTTYPES.costume:
				return myMannequinsServer.child(artMesh.myMannequinMesh.key);
			break;
		}
		
	}
	function getMeshTransformServer(artMesh){
		var generalMeshServer = getMeshServer(artMesh);
		switch(artMesh.artType){
			case ARTTYPES.stroke:
			case ARTTYPES.prim:
			case ARTTYPES.print:
				return generalMeshServer.child("transform");
			break;
			case ARTTYPES.mannequin:
				return generalMeshServer.child("mannequinTransform");
			break;
			case ARTTYPES.costume:
				return generalMeshServer.child("costumeTransform");
			break;
		}
	}
	
	function markArtMovingFinished(artMesh,finishedState,actuallyJustCancel){
		
		switch(artMesh.artType){
			case ARTTYPES.mannequin:
			case ARTTYPES.costume:
				return;//mannequin parts don't track finishedness
			break;//heh
		}
		
		var movingFinishedServer = getMeshServer(artMesh).child("movingFinished");
		
		if (!actuallyJustCancel) movingFinishedServer.set(finishedState);
		
		if (finishedState){
			movingFinishedServer.onDisconnect().cancel();
		} else {
			movingFinishedServer.onDisconnect().set(true);
		}
		
	}
	
	
	
	
	changeControlSystem(controlSystems.cursor);
	
	
	
	
	
	
	
	function detectControlSystemMode(){
		
		//this function is way simpler now that leap is out
		
		if ( (curControlSystem != controlSystems.tracked) && controlSystems.tracked.isAvailable() ) changeControlSystem(controlSystems.tracked);
		
	}
	
	
	
	
	
	
	var highlightingMesh;
	var lastHighlightingMesh;
	var detonatorWasPressed = true;
	var wasStretching = false;
	var transformStartVal;
	var transformServer;
	var drawingOffset;
	
	var lastUserAwaitingDeletion;
	
	
	function eraseHoverHandler(mesh){
		highlightingMesh = mesh;
	}
	function eraseClickHandler(mesh){
		eraseMesh(mesh);
	}
	
	function eraseMesh(mesh){
		getMeshServer(mesh).remove();
	}
	
	
	var pointingMesh;
	var pointingClicked;
	function transformHoverHandler(mesh){
		if (editModeVal == EDITMODES.Stretch) {
			if (mesh && (mesh.artType == ARTTYPES.mannequin)) return;//don't scale mannequins; it's confusing, and throws off the transforms furthermore
		}
		pointingMesh = mesh;
	}
	function transformClickHandler(mesh){
		pointingClicked = true;
	}
	
	
	
	var saveSelection = new Set();
	var potentialSaveSelectionAddition = new Set();
	function saveHoverHandler(mesh){
		// nothing on hover for save selections
	}
	function saveClickHandler(mesh){
		
		var mainMesh = mesh.multipartParent ? mesh.multipartParent : mesh;
		
		switch(mainMesh.artType){
			case ARTTYPES.mannequin:
			case ARTTYPES.costume:
				return;
			break;
		}
		
		if (saveSelection.has(mainMesh)) {
			deselectMesh(mainMesh);
		} else {
			saveSelection.add(mainMesh);
		}
		
	}
	
	
	// NOTE:
	// this blinking system currently alters the mesh's MATERIAL visibility,
	// so that a blinking mesh won't send your cursor through to the thing behind it.
	// this depends on everything blinkable having its OWN material,
	// which under ordinary circumstances wouldn't be particularly likely (esp. now with vertex colouring)
	// but as it happens is already the case because of yet another ridiculous altspace client bug.
	// anyway, all that to say, even if the bug eventually gets fixed, don't forget that all sub-bucket geometry needs its own mat, for blinkiness
	// (or to have an invisible mat assigned to it here rather than having its existing material set to invisible, maybe?)
	
	function setMeshVisibility(mesh,newState){
		switch(mesh.artType){
			case ARTTYPES.stroke:
			case ARTTYPES.prim:
			case ARTTYPES.mannequin:
				
				mesh.material.visible = newState;
				
			break;
			case ARTTYPES.print:
			case ARTTYPES.costume:
				
				for(var childIndex=0; childIndex<mesh.children.length; childIndex++){
					mesh.children[childIndex].material.visible = newState;
				}
				
			break;
		}
	}
	function deselectMesh(mesh){
		saveSelection.delete(mesh);
		setMeshVisibility(mesh,true);//because of flicker
	}
	SCULPT_selectionFloodAll = function(){
		
		function addMeshToSelection(mesh){
			switch(mesh.artType){
				case ARTTYPES.stroke:
				case ARTTYPES.prim:
				case ARTTYPES.print:
					
					saveSelection.add(mesh);
					
				break;
				case ARTTYPES.mannequin:
				case ARTTYPES.costume:
					//mannequins can't be put in archives
				break;
			}
			
		}
		
		if (selectionWhoseIsEveryone) {
			everyoneCallOnEveryArtHolder(addMeshToSelection);
		} else {
			personalCallOnEveryArtHolder(addMeshToSelection);
		}
		
	}
	SCULPT_selectionFloodNone = function(){
		saveSelection.forEach(function(mesh){ deselectMesh(mesh); });
	}
	
	
	
	SCULPT_saveSelection = function(title,callback){
		
		archiveArt(
			title,
			saveSelection,
			
			function(id,spawnPt){
				
				placePrintOnServer(id,spawnPt);
				
				saveSelection.forEach(function(curMesh){
					eraseMesh(curMesh);
				});
				
				callback();
				
			}
			
		);
		
	}
	SCULPT_isAnythingSelected = function(){
		return (saveSelection.size > 0);
	}
	
	
	
	SCULPT_selectionMethodChangeFunc = function(newVal){
		selectionModeIsClick = (newVal == SELECTIONMETHODS.Click);
		curControlSystem.updateEnabledness();
		refreshClickability();
	}
	
	var selectionWhoseIsEveryone;
	SCULPT_selectionWhoseChangeFunc = function(newVal,initialSet){
		selectionWhoseIsEveryone = (newVal == SELECTIONWHOSE.Everyone);
		refreshClickability();
	}
	
	
	
	
	var stripeCanvas = document.createElement('canvas');
	stripeCanvas.width = 4;
	stripeCanvas.height = 2;
	var stripeCtx = stripeCanvas.getContext('2d');
	stripeCtx.fillStyle = "#000";
	stripeCtx.fillRect(0,0,stripeCanvas.width,stripeCanvas.height);
	stripeCtx.fillStyle = "#FFF";
	stripeCtx.fillRect(0,0,stripeCanvas.width/2,stripeCanvas.height);
	var stripeTex = new THREE.Texture(stripeCanvas);
	stripeTex.wrapS = THREE.RepeatWrapping;
	stripeTex.wrapT = THREE.RepeatWrapping;
	stripeTex.repeat.set(16,16);
	var stripeMat = new THREE.MeshBasicMaterial({map:stripeTex});
	
	var saveSelectionBoundaryHolder = new THREE.Object3D();
	saveSelectionBoundaryHolder.name = "SAVE SELECTION BOUNDARY HOLDER";
	var axisHolders = [];
	var individualRings = [];
	for(var axis=0; axis<3; axis++){
		var curAxisHolder = new THREE.Object3D();
		axisHolders.push(curAxisHolder);
		saveSelectionBoundaryHolder.add(curAxisHolder);
		for(var lat = 1; lat<4; lat++){
			var latFrac = lat/4;
			var latRad = Math.sin(latFrac*Math.PI);
			var curRing = new THREE.Mesh(
				new THREE.TorusGeometry(latRad,0.01,3,24),
				stripeMat
			);
			curRing.position.y = Math.cos(latFrac*Math.PI);
			curRing.rotation.x = Math.PI/2;
			individualRings.push(curRing);
			curAxisHolder.add(curRing);
		}
	}
	axisHolders[1].rotation.x = Math.PI/2;
	axisHolders[2].rotation.z = Math.PI/2;
	mergeObjects(individualRings,saveSelectionBoundaryHolder,stripeMat);
	
	
	
	
	
	
	
	
	
	
	
	function frameFunc() {
		
		
		
		requestAnimationFrame(frameFunc);
		
		
		
		
		
		
		detectControlSystemMode();
		
		
		
		
		
		
		curControlSystem.frameFunc();
		
		
		
		
		
		
		
		
		function tryDrawing(){
			
			var curPointingInfo = curControlSystem.getDominantPointing();
			if (curPointingInfo) {
				
				if (!curPointsServer) {
					
					drawingOffset = curPointingInfo.fingerPos.clone();
					
					var curStrokeServer = myStrokesServer.push({
						color:myColVal,
						drawingFinished:false,
						movingFinished:true,
						transform:{
							p:[drawingOffset.x,drawingOffset.y,drawingOffset.z],
							s:[1,1,1],
							q:[0,0,0,1]
						}
					});
					curPointsServer = curStrokeServer.child('points');
					curStrokeServer.child('drawingFinished').onDisconnect().set(true);
					
				}
				
				
				
				if ( !lastPos || (curPointingInfo.fingerPos.distanceTo(lastPos) > curControlSystem.strokeMinDist) ) {
					
					var strokeThickness = 0.01 + strokeWidthFrac*0.08;
					var otherPos = offPtInDir(curPointingInfo.fingerPos,curPointingInfo.fingerQuat,strokeThickness);
					
					var newPoint = curPointsServer.push({vertices:[
						new THREE.Vector3().subVectors(curPointingInfo.fingerPos,drawingOffset),
						new THREE.Vector3().subVectors(otherPos,drawingOffset)
					]});
					
					lastPos = curPointingInfo.fingerPos;
					
				}
				
				
				
			} else {
				
				endStrokeDrawing();
				
			}
			
		}
		
		function tryPrimming(){
			
			var curPinchSpreadInfo = curControlSystem.getBothPinching();
			if (curPinchSpreadInfo) {
				
				
				
				var pinchSpace = curPinchSpreadInfo.rightPinch.distanceTo(curPinchSpreadInfo.leftPinch);
				
				var dataToUpdate = {};
				
				if (!cubeInProgress && (pinchSpace < curPinchSpreadInfo.spawnMargin)) {
					
					cubeInProgress = myPrimsServer.push();
					dataToUpdate.typeIndex = nextShapeVal.index;
					dataToUpdate.color = myColVal;
					dataToUpdate.movingFinished = false;
					
				}
				
				if (cubeInProgress) {
					
					//
					var avgQuat = new THREE.Quaternion();
					THREE.Quaternion.slerp(
						curPinchSpreadInfo.rightQuat,
						curPinchSpreadInfo.leftQuat,
					avgQuat,0.5);
					
					var handUp = new THREE.Vector3(0,1,0);
					handUp.applyQuaternion(avgQuat);
					
					var lookWorkMtx = new THREE.Matrix4();
					lookWorkMtx.lookAt(
						curPinchSpreadInfo.leftPinch,
						curPinchSpreadInfo.rightPinch,
						handUp
					);
					
					var rotQuat = new THREE.Quaternion();
					rotQuat.setFromRotationMatrix(lookWorkMtx);
					
					//
					
					dataToUpdate.transform = {
						'p':[
							(curPinchSpreadInfo.rightPinch.x + curPinchSpreadInfo.leftPinch.x)/2,
							(curPinchSpreadInfo.rightPinch.y + curPinchSpreadInfo.leftPinch.y)/2,
							(curPinchSpreadInfo.rightPinch.z + curPinchSpreadInfo.leftPinch.z)/2
						],
						's':[pinchSpace,pinchSpace,pinchSpace],
						'q':[rotQuat.x,rotQuat.y,rotQuat.z,rotQuat.w]
					};
					
					cubeInProgress.update(dataToUpdate);
					if (dataToUpdate.movingFinished === false) cubeInProgress.child("movingFinished").onDisconnect().set(true);
					
				}
				
			} else {
				
				endPrimDrawing();
				
			}
			
		}
		
		function trySelecting(){
			
			if (pointingMesh) {
				
				if (pointingMesh != selectedArtMesh) highlightingMesh = pointingMesh;
				
				if (pointingClicked) {
					
					var oldSelected = selectedArtMesh;
					selectedArtMesh = pointingMesh;
					if (oldSelected != selectedArtMesh) {
						if (oldSelected) markArtMovingFinished(oldSelected,true);
						markArtMovingFinished(selectedArtMesh,false);
					}
					curControlSystem.refreshArtSelected();
					
				}
				
			}
			
			// currently, NOTHING indicates which mesh has been selected, other than "it's the one that just stopped blinking".
			// but that should be obvious enough?? people will see it move every time they make changes, etc
			
		}
		
		function trySelectionOr(busyTest,alreadySelectedHandler,elseHandler){
			
			// okay it's 100% dumb that the selection code is this fragile
			// and requires all this setup/teardown stuff every frame,
			// but I'm not going to rewrite it all now
			// so this is the most graceful approach in the meantime imo
			
			highlightingMesh = null;
			
			if (busyTest()){
				
				alreadySelectedHandler();
				
			} else {
				
				elseHandler();
				trySelecting();
				
			}
			
			pointingClicked = false;
			
		}
		
		
		
		
		switch(editModeVal){
			
			
			case EDITMODES.Draw:
				
				tryDrawing();
				tryPrimming();//should be automatically discarded by prim-only control systems...
				// come to think of it there aren't any non-prim-only control systems left anyway, are there
				
			break;
			
			
			case EDITMODES.Shape:
				
				tryPrimming();
				
			break;
			
			
			case EDITMODES.Erase:
				
				// all handled by cursor listeners, now...
				
			break;
			
			case EDITMODES.Grab:
				
				trySelectionOr(
					
					function(){
						return curControlSystem.getIsGrabbing();
					},
					
					function(){
						
						if (!selectedArtMesh) return;
						
						var transformMtx = curControlSystem.getGrabIncrementMtx();
						
						var copyFrom = (selectedArtMesh.artType == ARTTYPES.mannequin) ? selectedArtMesh.myHolder : selectedArtMesh ;//standardize this somewhere?
						copyFrom.updateMatrix();//maybe redundant?
						var curMtx = copyFrom.matrix.clone();
						curMtx.premultiply(transformMtx);
						
						var serverMtx = makeServerTransformFromMtx(curMtx);
						if (selectedArtMesh.artType == ARTTYPES.mannequin) serverMtx.s = [1,1,1];//don't scale mannequins, it's misleading & throws off some math anyway
						getMeshTransformServer(selectedArtMesh).set(serverMtx);
						
					},
					
					function(){
						curControlSystem.grabStopped();//I'm not nuts about it being this vague but it should work?
					}
					
					
				);
				
			break;
			
			case EDITMODES.Slide:
			case EDITMODES.Turn:
			case EDITMODES.Stretch:
				
				trySelectionOr(
					
					function(){//busyTest
						return curControlSystem.getIsStretching();
					},
					
					function(){//alreadySelectedHandler
						
						var selectedLastServerTransInfo;
						if (selectedArtMesh.artType == ARTTYPES.mannequin) {
							selectedLastServerTransInfo = selectedArtMesh.myHolder.lastServerTransInfo;
						} else {
							selectedLastServerTransInfo = selectedArtMesh.lastServerTransInfo;
						}
						
						function getSelectedOrderedEulVal(){
							
							var lastQuatVals = selectedLastServerTransInfo['q'];
							var lastQuat = new THREE.Quaternion(lastQuatVals[0],lastQuatVals[1],lastQuatVals[2],lastQuatVals[3]);
							
							var axisOrder;
							switch(curControlSystem.getTransformAxis()){
								case 'x': axisOrder = 'ZYX'; break;
								case 'y': axisOrder = 'ZXY'; break;
								case 'z': axisOrder = 'XYZ'; break;
							}
							
							return new THREE.Euler().setFromQuaternion(lastQuat,axisOrder);
							
						}
						
						if (!wasStretching) {// if stretching just started, actually
							
							if (editModeVal==EDITMODES.Turn) {
								
								transformServer = getMeshTransformServer(selectedArtMesh).child("q");
								transformStartVal = getSelectedOrderedEulVal()[curControlSystem.getTransformAxis()];
								
							} else {
								
								var axisIndex;
								switch(curControlSystem.getTransformAxis()){
									case 'x': axisIndex=0; break;
									case 'y': axisIndex=1; break;
									case 'z': axisIndex=2; break;
								}
								var axisSet;
								switch(editModeVal){
									case EDITMODES.Slide:	axisSet="p"; break;
									case EDITMODES.Stretch:	axisSet="s"; break;
								}
								
								transformServer = getMeshTransformServer(selectedArtMesh).child(axisSet).child(axisIndex);
								transformStartVal = selectedLastServerTransInfo[axisSet][axisIndex];
								
							}
							
						}
						
						var newVal;
						switch(editModeVal){
							case EDITMODES.Slide:
							case EDITMODES.Turn:
								newVal = transformStartVal + curControlSystem.getDragProgressAmt();
							break;
							case EDITMODES.Stretch:
								newVal = transformStartVal * ( 1 + curControlSystem.getDragProgressAmt() );
							break;
						}
						
						if (editModeVal==EDITMODES.Turn){
							
							var curEul = getSelectedOrderedEulVal();
							curEul[curControlSystem.getTransformAxis()] = newVal;
							var curQuat = new THREE.Quaternion().setFromEuler(curEul);
							transformServer.set([curQuat.x,curQuat.y,curQuat.z,curQuat.w]);
							
						} else {
							
							transformServer.set(newVal);
							
						}
						
						wasStretching = true;
						
					},
					
					function(){//elseHandler
						
						wasStretching = false;
						
					}
					
				);
				
				
				
				
				
			break;
			case EDITMODES.Save:
				
				if (!selectionModeIsClick) {
					var curPinchSpreadInfo = curControlSystem.getBothPinching();
					if (curPinchSpreadInfo) {
						
						var potentialSelectionCenter = new THREE.Vector3();
						potentialSelectionCenter.lerpVectors(curPinchSpreadInfo.rightPinch,curPinchSpreadInfo.leftPinch,0.5);
						var potentialSelectionRadius = curPinchSpreadInfo.rightPinch.distanceTo(curPinchSpreadInfo.leftPinch)/2;
						
						potentialSaveSelectionAddition.forEach(function(mesh){ setMeshVisibility(mesh,true); });
						potentialSaveSelectionAddition.clear();
						
						function addThingsWithinRadius(mesh){
							
							if (Math.abs(mesh.position.x - potentialSelectionCenter.x) > potentialSelectionRadius) return;
							if (Math.abs(mesh.position.y - potentialSelectionCenter.y) > potentialSelectionRadius) return;
							if (Math.abs(mesh.position.z - potentialSelectionCenter.z) > potentialSelectionRadius) return;
							if (mesh.position.distanceTo(potentialSelectionCenter) < potentialSelectionRadius) {
								potentialSaveSelectionAddition.add(mesh);
							}
							
						}
						
						// SEARCH/ACT ON PRINT HOLDERS INSTEAD OF CHILDREN??
						if (selectionWhoseIsEveryone) {
							everyoneCallOnEveryArtHolder(addThingsWithinRadius);
						} else {
							everyoneCallOnEveryArtHolder(addThingsWithinRadius);
						}
						
						scene.add(saveSelectionBoundaryHolder);
						saveSelectionBoundaryHolder.position.copy(potentialSelectionCenter);
						saveSelectionBoundaryHolder.scale.set(potentialSelectionRadius,potentialSelectionRadius,potentialSelectionRadius);
						
					} else {
						if (potentialSaveSelectionAddition.size) {
							potentialSaveSelectionAddition.forEach(function(item){ saveSelection.add(item); });
							potentialSaveSelectionAddition.clear();
						}
						if (saveSelectionBoundaryHolder.parent) saveSelectionBoundaryHolder.parent.remove(saveSelectionBoundaryHolder);
					}
				}
				
			break;
			
		}
		
		
		
		
		if (highlightingMesh) setMeshVisibility(highlightingMesh, Math.round((Date.now()/100)%2) );//flicker
		
		if (lastHighlightingMesh) {
			if (lastHighlightingMesh != highlightingMesh) {
				// THIS MIGHT RUN EVEN IF THE PRIM HAS BEEN DELETED!!
				// atm that's okay? but if it's ever not safe, do a check for its existence
				setMeshVisibility(lastHighlightingMesh, true);
			}
		}
		
		lastHighlightingMesh = highlightingMesh;
		
		
		
		
		function setVisibilityOfUsersArt(userId,visibility){
			userArtVisibilityToggles.get(userId)(visibility);
		}
		
		// this is pretty redundant with the highlighting system...
		if (userAwaitingDeletion) setVisibilityOfUsersArt( userAwaitingDeletion, Math.round((Date.now()/100)%2) );
		if (lastUserAwaitingDeletion && (lastUserAwaitingDeletion != userAwaitingDeletion)) setVisibilityOfUsersArt( lastUserAwaitingDeletion , true );
		lastUserAwaitingDeletion = userAwaitingDeletion;
		
		
		
		// and redundant again, heh
		saveSelection.forEach(function(mesh){ setMeshVisibility(mesh, Math.round((Date.now()/100)%2) ); });
		potentialSaveSelectionAddition.forEach(function(mesh){ setMeshVisibility(mesh, Math.round((Date.now()/100)%2) ); });
		
		
		
		
		
		
		
		// actually perform the clickability changes decided on over the course of this frame:
		
		clickabilityDirtyMeshes.forEach(function(mesh){
			if (mesh.newClickability) {
				if (!mesh.myNativeCollider) mesh.myNativeCollider = new NativeComponent('n-mesh-collider',{convex:false,type:'hologram'},mesh);
				// is it worth cacheing the collider instead of recreating it?
			} else {
				if (mesh.myNativeCollider) mesh.myNativeCollider.remove();
				mesh.myNativeCollider = null;
			}
		});
		clickabilityDirtyMeshes.clear();
		
		
		
		curControlSystem.frameEnd();
		
		
		
		
		
		if (paletteOpen) {
			if (paletteHolder.position.distanceTo(headJoint.position) > 3) {
				hidePalette();
			}
		}
		
		
		
		
		// turn all mannequin buttons to face the user
		var workMtx = new THREE.Matrix4();
		for(var i=0; i<allMannequinsLists.length; i++){
			allMannequinsLists[i].forEach(function(mannequinMesh,mannequinKey){
				
				var localHeadPos = headJoint.position.clone();
				workMtx.getInverse(mannequinMesh.myHolder.matrix);
				localHeadPos.applyMatrix4(workMtx);
				
				var localHeadYaw = Math.atan2(localHeadPos.z,localHeadPos.x);
				mannequinMesh.pedestalFrame.rotation.set(0,Math.PI/2-localHeadYaw,0);
				
			});
		}
		
		
		
		
		renderer.render(scene);
		
		
		
	}
	
	frameFunc();
	
	
	
	
	
	
	
	
	
	
	
	
	
}

fileReady();
