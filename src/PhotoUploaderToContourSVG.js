export default class PhotoUploaderToContourSVG extends HTMLElement {
  constructor() {
	super();
	
	this.attachShadow({ mode: "open" });
	
	this.shadowRoot.innerHTML = `
	  <style>
		:host {
		  display: block;
		}
	
	  </style>
	
	  <div class="wrap">
	  	<div id="status"></div>
		<slot></slot>
	  </div>
	`;
	
  }

  _unwrapSvg(svgString) {
	const parser = new DOMParser();
	const doc = parser.parseFromString(svgString, "image/svg+xml");
  
	const svg = doc.documentElement;
  
	if (!svg || svg.tagName.toLowerCase() !== "svg") {
	  throw new Error("Input is not a valid SVG string.");
	}
  
	return svg.innerHTML.trim();
  }

  connectedCallback() {
	const form = this.closest("form");
	
	const fileInput = this.querySelector('input[type="file"]');
	
	const statusEl = this.shadowRoot.getElementById("status");
	
	const uploadBtn = form.querySelector("[type='submit']");
	
	const svg_target_element = document.querySelector(this.getAttribute('target_selector'))
	console.log("This is my target element:", svg_target_element)
	
	form.addEventListener("submit", async (event) => {
		event.preventDefault();
	
		if (!fileInput.files.length) {
			statusEl.textContent = "Please choose at least one file.";
			return;
		}
	
		const formData = new FormData();
		for (const file of fileInput.files) {
			formData.append("photos[]", file);
		}
	
		uploadBtn.disabled = true;
		statusEl.textContent = "Uploading...";
	
		try {
			const response = await fetch("../upload.php", {
				method: "POST",
				body: formData
			});
	
			const result = await response.json();
	
			if (!response.ok) {
				throw new Error(result.error || "Upload failed.");
			}
	
			statusEl.innerHTML = "";
	
			if (!result.files || !result.files.length) {
				statusEl.textContent = "No files were returned.";
				return;
			}
	
			for (const file of result.files) {
				console.log('for this file..')
				const div = document.createElement("div");
				div.className = "upload-result";
	
				if (file.status === "success") {
					console.log('... uploaded with success! ...')
					div.innerHTML = `
						<p>
							Saved <strong>${file.original_name}</strong> as
							<a href="${file.url}" target="_blank">${file.filename}</a>
						</p>
					`;
					console.log('... attemtping to measure ...')
					const measureStatus = document.createElement("p");
					measureStatus.textContent = "Measuring...";
					statusEl.appendChild(measureStatus);
	
					try {
						const measureResponse = await fetch(file.measure_url);
						const measureData = await measureResponse.json();
	
						if (!measureResponse.ok) {
							throw new Error("Measure request failed.");
						}
						
						svg_target_element.insertAdjacentHTML("beforeend", this._unwrapSvg(measureData.svg[0]));
						
					} catch (measureError) {
						measureStatus.textContent = "Measurement error: " + measureError.message;
					}
	
				} else {
					div.textContent = `Error uploading ${file.original_name}: ${file.message}`;
				}
	
				statusEl.appendChild(div);
				console.log('Target element', svg_target_element)
			}
	
		} catch (error) {
			statusEl.textContent = "Error: " + error.message;
		} finally {
			uploadBtn.disabled = false;
		}
	});

  }

  disconnectedCallback() {

  }


}

customElements.define("photo-uploader-to-contour-svg", PhotoUploaderToContourSVG);