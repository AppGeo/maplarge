const blankUrl = `https://maps.gstatic.com/mapfiles/transparent.png`;
export default (url, div) => {
  if (url === blankUrl) {
    while (div.firstChild) {
      div.removeChild(div.firstChild);
    }
    return;
  }
  var img = div.firstChild;
  if (img && img.src === url) {
    return;
  }
  var newImage = document.createElement('img');
  newImage.src = url;
  newImage.alt = '';
  if (!img) {
    div.appendChild(newImage);
  } else {
    div.replaceChild(newImage, img);
  }
};
