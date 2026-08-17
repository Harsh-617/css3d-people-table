import * as THREE from 'three';
import TWEEN from 'three/addons/libs/tween.module.js';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

// ---------------------------------------------------------------------
// CONFIG — fill these in from your own Google Sheet / Cloud Console
// ---------------------------------------------------------------------
const GOOGLE_CLIENT_ID = '581557013779-bafpacmfk7qtl52vvlj09agdd52876ti.apps.googleusercontent.com';
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQvR949Z2v1nOBefbib2akseQOvtdSvHjNpofTPAAO-1M8IV6yCP2EC9lkb86QsLifCO4f4XcCQkduj/pub?gid=0&single=true&output=csv';

// ---------------------------------------------------------------------
// Google Sign-In
// ---------------------------------------------------------------------

function waitForGoogleIdentity( callback ) {

    if ( window.google && window.google.accounts && window.google.accounts.id ) {

        callback();

    } else {

        setTimeout( () => waitForGoogleIdentity( callback ), 50 );

    }

}

function decodeJwt( token ) {

    const payload = token.split( '.' )[ 1 ];
    const json = atob( payload.replace( /-/g, '+' ).replace( /_/g, '/' ) );
    return JSON.parse( json );

}

function handleCredentialResponse( response ) {

    let profile;

    try {

        profile = decodeJwt( response.credential );

    } catch ( err ) {

        document.getElementById( 'login-status' ).textContent = 'Could not read sign-in response. Please try again.';
        return;

    }

    document.getElementById( 'login-screen' ).style.display = 'none';
    document.getElementById( 'info' ).textContent = `Signed in as ${ profile.name } — drag to rotate, scroll to zoom.`;

    loadDataAndStart();

}

function initGoogleSignIn() {

    google.accounts.id.initialize( {
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse
    } );

    google.accounts.id.renderButton(
        document.getElementById( 'google-btn-slot' ),
        { theme: 'filled_black', size: 'large', shape: 'pill' }
    );

}

waitForGoogleIdentity( initGoogleSignIn );

// ---------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------

function parseNetWorth( raw ) {

    if ( ! raw ) return 0;
    const cleaned = String( raw ).replace( /[^0-9.]/g, '' );
    return parseFloat( cleaned ) || 0;

}

function loadDataAndStart() {

    document.getElementById( 'loading-screen' ).style.display = 'flex';

    fetch( SHEET_CSV_URL )
        .then( res => {

            if ( ! res.ok ) throw new Error( 'Network response was not ok (' + res.status + ')' );
            return res.text();

        } )
        .then( csvText => {

            const parsed = Papa.parse( csvText, {
                header: true,
                skipEmptyLines: true,
                transformHeader: h => h.trim()
            } );

            const people = parsed.data.map( row => ( {
                name: row.Name || 'Unknown',
                photo: row.Photo || '',
                age: row.Age || '',
                country: row.Country || '',
                interest: row.Interest || '',
                netWorth: parseNetWorth( row[ 'Net Worth' ] )
            } ) );

            document.getElementById( 'loading-screen' ).style.display = 'none';
            init( people );
            animate();

        } )
        .catch( err => {

            document.getElementById( 'loading-screen' ).innerHTML =
                'Could not load data from the Google Sheet.<br>' + err.message;

        } );

}

// ---------------------------------------------------------------------
// Colour coding by net worth
// ---------------------------------------------------------------------

function colorForNetWorth( netWorth ) {

    if ( netWorth < 100000 ) {

        return { bg: 'rgba(226,75,74,0.18)', border: 'rgba(226,75,74,0.8)' };

    } else if ( netWorth <= 200000 ) {

        return { bg: 'rgba(239,159,39,0.18)', border: 'rgba(239,159,39,0.8)' };

    } else {

        return { bg: 'rgba(99,196,106,0.18)', border: 'rgba(99,196,106,0.8)' };

    }

}

// ---------------------------------------------------------------------
// Three.js scene
// ---------------------------------------------------------------------

let camera, scene, renderer, controls;
const objects = [];
const targets = { table: [], sphere: [], helix: [], grid: [] };

function init( people ) {

    camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 1, 10000 );
    camera.position.z = 3000;

    scene = new THREE.Scene();

    const COLS = 20, ROWS = 10; // table: 20 x 10 = 200
    const GX = 5, GY = 4, GZ = 10; // grid: 5 x 4 x 10 = 200

    for ( let i = 0; i < people.length; i ++ ) {

        const person = people[ i ];
        const colors = colorForNetWorth( person.netWorth );

        const element = document.createElement( 'div' );
        element.className = 'element';
        element.style.backgroundColor = colors.bg;
        element.style.borderColor = colors.border;

        const worth = document.createElement( 'div' );
        worth.className = 'worth';
        worth.textContent = '$' + Math.round( person.netWorth / 1000 ) + 'K';
        element.appendChild( worth );

        const photo = document.createElement( 'div' );
        photo.className = 'photo';
        if ( person.photo ) {

            const img = document.createElement( 'img' );
            img.src = person.photo;
            img.loading = 'lazy';
            img.onerror = () => { photo.style.background = colors.border; img.remove(); };
            photo.appendChild( img );

        }
        element.appendChild( photo );

        const name = document.createElement( 'div' );
        name.className = 'name';
        name.textContent = person.name;
        element.appendChild( name );

        const details = document.createElement( 'div' );
        details.className = 'details';
        details.innerHTML = `${ person.age } · ${ person.country }<br>${ person.interest }`;
        element.appendChild( details );

        const objectCSS = new CSS3DObject( element );
        objectCSS.position.x = Math.random() * 4000 - 2000;
        objectCSS.position.y = Math.random() * 4000 - 2000;
        objectCSS.position.z = Math.random() * 4000 - 2000;
        scene.add( objectCSS );

        objects.push( objectCSS );

        // --- table target: sequential fill, 20 columns x 10 rows ---

        const col = i % COLS;
        const row = Math.floor( i / COLS );

        const tableObj = new THREE.Object3D();
        tableObj.position.x = ( col * 150 ) - ( ( COLS - 1 ) * 150 ) / 2;
        tableObj.position.y = - ( row * 190 ) + ( ( ROWS - 1 ) * 190 ) / 2;
        targets.table.push( tableObj );

        // --- grid target: 5 x 4 x 10 ---

        const gcol = i % GX;
        const grow = Math.floor( i / GX ) % GY;
        const glayer = Math.floor( i / ( GX * GY ) );

        const gridObj = new THREE.Object3D();
        gridObj.position.x = ( gcol * 400 ) - ( ( GX - 1 ) * 400 ) / 2;
        gridObj.position.y = - ( grow * 400 ) + ( ( GY - 1 ) * 400 ) / 2;
        gridObj.position.z = ( glayer * 500 ) - ( ( GZ - 1 ) * 500 ) / 2;
        targets.grid.push( gridObj );

    }

    // --- sphere target: generic, works for any object count ---

    const vector = new THREE.Vector3();

    for ( let i = 0, l = objects.length; i < l; i ++ ) {

        const phi = Math.acos( - 1 + ( 2 * i ) / l );
        const theta = Math.sqrt( l * Math.PI ) * phi;

        const object = new THREE.Object3D();
        object.position.setFromSphericalCoords( 800, phi, theta );

        vector.copy( object.position ).multiplyScalar( 2 );
        object.lookAt( vector );

        targets.sphere.push( object );

    }

    // --- double helix target: two strands, offset 180 degrees ---
    // even indices -> strand A, odd indices -> strand B, so adjacent
    // data rows sit across from each other like DNA base pairs.

    const strandCount = Math.ceil( objects.length / 2 );

    for ( let i = 0, l = objects.length; i < l; i ++ ) {

        const strand = i % 2;
        const idx = Math.floor( i / 2 );

        const theta = idx * 0.34 + Math.PI + ( strand * Math.PI );
        const y = - ( idx * 9 ) + ( strandCount * 9 ) / 2;

        const object = new THREE.Object3D();
        object.position.setFromCylindricalCoords( 900, theta, y );

        vector.x = object.position.x * 2;
        vector.y = object.position.y;
        vector.z = object.position.z * 2;
        object.lookAt( vector );

        targets.helix.push( object );

    }

    // --- renderer / controls ---

    renderer = new CSS3DRenderer();
    renderer.setSize( window.innerWidth, window.innerHeight );
    document.getElementById( 'container' ).appendChild( renderer.domElement );

    controls = new TrackballControls( camera, renderer.domElement );
    controls.minDistance = 500;
    controls.maxDistance = 6000;
    controls.addEventListener( 'change', render );

    document.getElementById( 'table' ).addEventListener( 'click', () => transform( targets.table, 2000 ) );
    document.getElementById( 'sphere' ).addEventListener( 'click', () => transform( targets.sphere, 2000 ) );
    document.getElementById( 'helix' ).addEventListener( 'click', () => transform( targets.helix, 2000 ) );
    document.getElementById( 'grid' ).addEventListener( 'click', () => transform( targets.grid, 2000 ) );

    transform( targets.table, 2000 );

    window.addEventListener( 'resize', onWindowResize );

}

function transform( targetArr, duration ) {

    TWEEN.removeAll();

    for ( let i = 0; i < objects.length; i ++ ) {

        const object = objects[ i ];
        const target = targetArr[ i ];

        new TWEEN.Tween( object.position )
            .to( { x: target.position.x, y: target.position.y, z: target.position.z }, Math.random() * duration + duration )
            .easing( TWEEN.Easing.Exponential.InOut )
            .start();

        new TWEEN.Tween( object.rotation )
            .to( { x: target.rotation.x, y: target.rotation.y, z: target.rotation.z }, Math.random() * duration + duration )
            .easing( TWEEN.Easing.Exponential.InOut )
            .start();

    }

    new TWEEN.Tween( {} )
        .to( {}, duration * 2 )
        .onUpdate( render )
        .start();

}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
    render();

}

function animate() {

    requestAnimationFrame( animate );
    TWEEN.update();
    controls.update();

}

function render() {

    renderer.render( scene, camera );

}
