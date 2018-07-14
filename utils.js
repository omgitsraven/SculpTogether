
// 3d stuff


function vertexShadeGeom(geom,vertexShadeFunc){
	for(var faceIndex=0; faceIndex<geom.faces.length; faceIndex++){
		var curFace = geom.faces[faceIndex];
		curFace.vertexColors[0] = vertexShadeFunc(geom.vertices[curFace.a],curFace.a,curFace.vertexNormals[0],faceIndex*3+0);
		curFace.vertexColors[1] = vertexShadeFunc(geom.vertices[curFace.b],curFace.b,curFace.vertexNormals[1],faceIndex*3+1);
		curFace.vertexColors[2] = vertexShadeFunc(geom.vertices[curFace.c],curFace.c,curFace.vertexNormals[2],faceIndex*3+2);
	}
}




function addParentMtxUntil(obj,accumMtx,root){
	//console.log(obj.name,"parent is",obj.parent.name);
	if (obj.parent != root) addParentMtxUntil(obj.parent,accumMtx,root);
	obj.updateMatrixWorld();
	accumMtx.multiply(obj.matrix);
}
function getMtxUntil(obj,root){
	//console.log("* getting mtx from",obj.name,"until",root.name);
	var accumMtx = new THREE.Matrix4();
	addParentMtxUntil(obj,accumMtx,root);
	return accumMtx;
}
function mergeObjects(objectList,intoParent,withMat,preserveOriginals){
	
	var holderGeom = new THREE.Geometry();
	
	for(var i=0; i<objectList.length; i++){
		var curObj = objectList[i];
		var curGeom = curObj.mergeGeom ? curObj.mergeGeom : curObj.geometry ;
		holderGeom.merge( curGeom, getMtxUntil(curObj,intoParent) );
		if (preserveOriginals) {
			curObj.visible = false;
		} else {
			curObj.parent.remove(curObj);
		}
	}
	
	if (!withMat) return holderGeom;
	
	var holderMesh = new THREE.Mesh(holderGeom,withMat);
	makeIntangible(holderMesh);
	intoParent.add(holderMesh);
	
	return holderMesh;
	
}




function flipGeom(geom){
	
	for(var i=0; i<geom.faces.length; i++){
		
		var curFace = geom.faces[i];
		
		var bucket = curFace.b;
		curFace.b = curFace.c;
		curFace.c = bucket;
		
		curFace.normal.negate();
		for(var j=0; j<curFace.vertexNormals.length; j++) curFace.vertexNormals[j].negate();
		
		var bucket = curFace.vertexNormals[1];
		curFace.vertexNormals[1] = curFace.vertexNormals[2];
		curFace.vertexNormals[2] = bucket;
		
	}
	geom.elementsNeedUpdate = true;
	
	for(var i=0; i<geom.faceVertexUvs[0].length; i++){
		var curFace = geom.faceVertexUvs[0][i];
		var bucket = curFace[1];
		curFace[1] = curFace[2];
		curFace[2] = bucket;
	}
	geom.uvsNeedUpdate = true;
	
	
	
}



function createDoubleSidedGeomClone(oneSidedGeom){
	
	var doubleSidedGeom = oneSidedGeom.clone();
	for(var i=0; i<oneSidedGeom.faces.length; i++){//SPECIFICALLY ONESIDEDGEOM.FACES!! the original! meaning its length won't be changed by the pushes
		
		var origFace = oneSidedGeom.faces[i];
		
		var newFace = new THREE.Face3(
			origFace.a,
			origFace.c,
			origFace.b
		);
		newFace.vertexColors[0] = origFace.vertexColors[0];
		newFace.vertexColors[2] = origFace.vertexColors[1];
		newFace.vertexColors[1] = origFace.vertexColors[2];
		
		doubleSidedGeom.faces.push(newFace);
		
	}
	doubleSidedGeom.computeVertexNormals();//?
	
	return doubleSidedGeom;
	
}






function quatDot(a,b) {
	return a.x*b.x + a.y*b.y + a.z*b.z + a.w*b.w;
}
function quatDist(a,b) {
	return (1-Math.abs(quatDot(a,b)));//should be *2 according to formula, but that gives answers from 0-2, and I'd rather 0-1 anyway?
}

function offPtInDir(pt,dir,dist){
	var off = new THREE.Vector3(0,0,dist);
	off.applyQuaternion(dir);
	off.add(pt);
	return off;
}








// altspace stuff


function setTangibility(newMesh,newState){
	newMesh.userData.altspace = {collider:{enabled:newState}};
}
function makeIntangible(newMesh){
	setTangibility(newMesh,false);
}







// general stuff

var timerStart = performance.now();
function timeLog(msg,resetTimer){
	if (resetTimer) timerStart = performance.now();
	var gap = performance.now() - timerStart;
	console.log(gap,"-",msg);
}


function fullPath(filename,withSearch){
	var curPath = location.pathname;
	if (!curPath.endsWith('/')) curPath = location.pathname.split('/').slice(0, -1).join('/') + '/';
	curPath = location.origin + curPath + filename;
	if (withSearch) curPath += location.search;
	return curPath;
}



function doAllPromises(promiseList,callback){
	var numFinished=0;
	function promiseFinished(){
		numFinished++;
		//console.log("PROMISES",numFinished,"/",promiseList.length);
		if (numFinished==promiseList.length) callback();
	}
	for(var i=0; i<promiseList.length; i++) promiseList[i](promiseFinished);
}

fileReady();
