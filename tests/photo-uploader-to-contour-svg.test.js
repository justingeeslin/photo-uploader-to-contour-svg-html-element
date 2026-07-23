// test/photo-uploader-to-contour-svg.test.js

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi
} from "vitest";

// Change this path to the location of your component.
import "../src/PhotoUploaderToContourSVG.js";

/**
 * Wait until an assertion succeeds or a timeout is reached.
 */
async function waitFor(assertion, timeout = 1000) {
  const started = Date.now();

  while (true) {
	try {
	  assertion();
	  return;
	} catch (error) {
	  if (Date.now() - started >= timeout) {
		throw error;
	  }

	  await new Promise(resolve => setTimeout(resolve, 10));
	}
  }
}

/**
 * Create the DOM structure expected by the custom element.
 *
 * The component expects:
 * - A containing form
 * - A file input inside the custom element
 * - A submit button inside the form
 * - An optional SVG target elsewhere in the document
 */
function createFixture({
  includeFile = true,
  includeTarget = true
} = {}) {
  const form = document.createElement("form");

  const uploader = document.createElement(
	"photo-uploader-to-contour-svg"
  );

  uploader.setAttribute("target_selector", "#svg-target");

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.multiple = true;

  uploader.append(fileInput);

  const submitButton = document.createElement("button");
  submitButton.type = "submit";
  submitButton.textContent = "Upload";

  form.append(uploader, submitButton);
  document.body.append(form);

  let target = null;

  if (includeTarget) {
	target = document.createElementNS(
	  "http://www.w3.org/2000/svg",
	  "svg"
	);

	target.id = "svg-target";
	document.body.append(target);
  }

  if (includeFile) {
	const file = new File(
	  ["fake image contents"],
	  "photo.png",
	  { type: "image/png" }
	);

	const transfer = new DataTransfer();
	transfer.items.add(file);

	fileInput.files = transfer.files;
  }

  return {
	form,
	uploader,
	fileInput,
	submitButton,
	target,
	status: uploader.shadowRoot.getElementById("status")
  };
}

/**
 * Dispatch the submit event that the component listens for.
 */
function submit(form) {
  form.dispatchEvent(
	new Event("submit", {
	  bubbles: true,
	  cancelable: true
	})
  );
}

/**
 * Construct a JSON Response for mocked fetch calls.
 */
function jsonResponse(data, options = {}) {
  return new Response(JSON.stringify(data), {
	status: options.status ?? 200,
	headers: {
	  "Content-Type": "application/json"
	}
  });
}

describe("<photo-uploader-to-contour-svg>", () => {
  beforeEach(() => {
	document.body.innerHTML = "";
  });

  afterEach(() => {
	document.body.innerHTML = "";

	// fetch is replaced in several tests. Vitest does not automatically
	// restore stubbed globals unless configured to do so.
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
  });

  test("registers the custom element", () => {
	const constructor = customElements.get(
	  "photo-uploader-to-contour-svg"
	);

	expect(constructor).toBeDefined();
  });

  test("creates its shadow DOM", () => {
	const { uploader, status } = createFixture({
	  includeFile: false
	});

	expect(uploader.shadowRoot).not.toBeNull();
	expect(status).not.toBeNull();
	expect(uploader.shadowRoot.querySelector("slot")).not.toBeNull();
  });

  test("extractSvgChildren returns the child elements of an SVG", () => {
	const { uploader } = createFixture({
	  includeFile: false
	});

	const children = uploader.extractSvgChildren(`
	  <svg xmlns="http://www.w3.org/2000/svg">
		<rect x="1" y="2" width="10" height="20" />
		<path d="M 0 0 L 10 10" />
	  </svg>
	`);

	expect(children).toHaveLength(2);
	expect(children[0].tagName.toLowerCase()).toBe("rect");
	expect(children[1].tagName.toLowerCase()).toBe("path");
  });

  test("extractSvgChildren rejects a non-SVG document", () => {
	const { uploader } = createFixture({
	  includeFile: false
	});

	expect(() => {
	  uploader.extractSvgChildren(`
		<html>
		  <body>Not an SVG</body>
		</html>
	  `);
	}).toThrow("Invalid SVG");
  });

  test("shows a message when no file has been selected", async () => {
	const {
	  form,
	  status,
	  submitButton
	} = createFixture({
	  includeFile: false
	});

	const fetchMock = vi.fn();
	vi.stubGlobal("fetch", fetchMock);

	submit(form);

	await waitFor(() => {
	  expect(status.textContent).toBe(
		"Please choose at least one file."
	  );
	});

	expect(fetchMock).not.toHaveBeenCalled();
	expect(submitButton.disabled).toBe(false);
  });

  test("uploads selected files using FormData", async () => {
	const {
	  form,
	  fileInput
	} = createFixture();

	const fetchMock = vi.fn().mockResolvedValue(
	  jsonResponse({
		files: []
	  })
	);

	vi.stubGlobal("fetch", fetchMock);

	submit(form);

	await waitFor(() => {
	  expect(fetchMock).toHaveBeenCalledOnce();
	});

	const [url, options] = fetchMock.mock.calls[0];

	expect(url).toBe("../upload.php");
	expect(options.method).toBe("POST");
	expect(options.body).toBeInstanceOf(FormData);

	const uploadedFiles = options.body.getAll("photos[]");

	expect(uploadedFiles).toHaveLength(1);
	expect(uploadedFiles[0]).toBe(fileInput.files[0]);
	expect(uploadedFiles[0].name).toBe("photo.png");
  });

  test("shows a message when the upload returns no files", async () => {
	const {
	  form,
	  status,
	  submitButton
	} = createFixture();

	vi.stubGlobal(
	  "fetch",
	  vi.fn().mockResolvedValue(
		jsonResponse({
		  files: []
		})
	  )
	);

	submit(form);

	await waitFor(() => {
	  expect(status.textContent).toBe(
		"No files were returned."
	  );
	});

	expect(submitButton.disabled).toBe(false);
  });

  test("shows the server error when the upload fails", async () => {
	const {
	  form,
	  status,
	  submitButton
	} = createFixture();

	vi.stubGlobal(
	  "fetch",
	  vi.fn().mockResolvedValue(
		jsonResponse(
		  {
			error: "Unsupported image format."
		  },
		  {
			status: 400
		  }
		)
	  )
	);

	submit(form);

	await waitFor(() => {
	  expect(status.textContent).toBe(
		"Error: Unsupported image format."
	  );
	});

	expect(submitButton.disabled).toBe(false);
  });

  test("shows the default error when the server supplies no error message", async () => {
	const {
	  form,
	  status
	} = createFixture();

	vi.stubGlobal(
	  "fetch",
	  vi.fn().mockResolvedValue(
		jsonResponse(
		  {},
		  {
			status: 500
		  }
		)
	  )
	);

	submit(form);

	await waitFor(() => {
	  expect(status.textContent).toBe(
		"Error: Upload failed."
	  );
	});
  });

  test("reports an individual file upload failure", async () => {
	const {
	  form,
	  status
	} = createFixture();

	vi.stubGlobal(
	  "fetch",
	  vi.fn().mockResolvedValue(
		jsonResponse({
		  files: [
			{
			  status: "error",
			  original_name: "photo.png",
			  message: "The file was too large."
			}
		  ]
		})
	  )
	);

	submit(form);

	await waitFor(() => {
	  expect(status.textContent).toContain(
		"Error uploading photo.png: The file was too large."
	  );
	});

	expect(
	  status.querySelector(".upload-result")
	).not.toBeNull();
  });

  test("requests contour measurement after a successful upload", async () => {
	const {
	  form
	} = createFixture();

	const fetchMock = vi
	  .fn()
	  .mockResolvedValueOnce(
		jsonResponse({
		  files: [
			{
			  status: "success",
			  original_name: "photo.png",
			  filename: "saved-photo.png",
			  url: "/uploads/saved-photo.png",
			  measure_url: "/measure/saved-photo.png"
			}
		  ]
		})
	  )
	  .mockResolvedValueOnce(
		jsonResponse({
		  svg: [
			`
			  <svg xmlns="http://www.w3.org/2000/svg">
				<path d="M 0 0 L 10 10" />
			  </svg>
			`
		  ]
		})
	  );

	vi.stubGlobal("fetch", fetchMock);

	submit(form);

	await waitFor(() => {
	  expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	expect(fetchMock.mock.calls[0][0]).toBe("../upload.php");
	expect(fetchMock.mock.calls[1][0]).toBe(
	  "/measure/saved-photo.png"
	);
  });

  test("dispatches one SVGready event for each measured SVG child", async () => {
	const {
	  form
	} = createFixture();

	const listener = vi.fn();

	// The component dispatches SVGready from the form.
	form.addEventListener("SVGready", listener);

	const fetchMock = vi
	  .fn()
	  .mockResolvedValueOnce(
		jsonResponse({
		  files: [
			{
			  status: "success",
			  original_name: "photo.png",
			  filename: "saved-photo.png",
			  url: "/uploads/saved-photo.png",
			  measure_url: "/measure/saved-photo.png"
			}
		  ]
		})
	  )
	  .mockResolvedValueOnce(
		jsonResponse({
		  svg: [
			`
			  <svg xmlns="http://www.w3.org/2000/svg">
				<rect
				  id="measured-rect"
				  x="1"
				  y="2"
				  width="30"
				  height="40"
				/>
				<path
				  id="measured-path"
				  d="M 0 0 L 10 10"
				/>
			  </svg>
			`
		  ]
		})
	  );

	vi.stubGlobal("fetch", fetchMock);

	submit(form);

	await waitFor(() => {
	  expect(listener).toHaveBeenCalledTimes(2);
	});

	const firstEvent = listener.mock.calls[0][0];
	const secondEvent = listener.mock.calls[1][0];

	expect(firstEvent).toBeInstanceOf(CustomEvent);
	expect(firstEvent.type).toBe("SVGready");
	expect(firstEvent.bubbles).toBe(true);
	expect(firstEvent.composed).toBe(true);

	expect(firstEvent.detail).toBeInstanceOf(SVGElement);
	expect(firstEvent.detail.tagName.toLowerCase()).toBe("rect");
	expect(firstEvent.detail.id).toBe("measured-rect");

	expect(secondEvent.detail).toBeInstanceOf(SVGElement);
	expect(secondEvent.detail.tagName.toLowerCase()).toBe("path");
	expect(secondEvent.detail.id).toBe("measured-path");
  });

  test("allows an outside listener to receive SVGready", async () => {
	const {
	  form
	} = createFixture();

	const outsideListener = vi.fn();

	document.body.addEventListener(
	  "SVGready",
	  outsideListener
	);

	vi.stubGlobal(
	  "fetch",
	  vi
		.fn()
		.mockResolvedValueOnce(
		  jsonResponse({
			files: [
			  {
				status: "success",
				original_name: "photo.png",
				filename: "saved-photo.png",
				url: "/uploads/saved-photo.png",
				measure_url: "/measure/saved-photo.png"
			  }
			]
		  })
		)
		.mockResolvedValueOnce(
		  jsonResponse({
			svg: [
			  `
				<svg xmlns="http://www.w3.org/2000/svg">
				  <path id="outside-path" d="M 0 0 L 5 5" />
				</svg>
			  `
			]
		  })
		)
	);

	submit(form);

	await waitFor(() => {
	  expect(outsideListener).toHaveBeenCalledOnce();
	});

	const event = outsideListener.mock.calls[0][0];

	expect(event.detail.id).toBe("outside-path");
	expect(event.composed).toBe(true);
	expect(event.bubbles).toBe(true);
  });

  test("appends measured SVG children to the selected target", async () => {
	const {
	  form,
	  target
	} = createFixture();

	vi.stubGlobal(
	  "fetch",
	  vi
		.fn()
		.mockResolvedValueOnce(
		  jsonResponse({
			files: [
			  {
				status: "success",
				original_name: "photo.png",
				filename: "saved-photo.png",
				url: "/uploads/saved-photo.png",
				measure_url: "/measure/saved-photo.png"
			  }
			]
		  })
		)
		.mockResolvedValueOnce(
		  jsonResponse({
			svg: [
			  `
				<svg xmlns="http://www.w3.org/2000/svg">
				  <rect
					id="inserted-rect"
					width="25"
					height="35"
				  />
				</svg>
			  `
			]
		  })
		)
	);

	submit(form);

	await waitFor(() => {
	  expect(
		target.querySelector("#inserted-rect")
	  ).not.toBeNull();
	});

	const inserted = target.querySelector("#inserted-rect");

	expect(inserted).toBeInstanceOf(SVGElement);
	expect(inserted.getAttribute("width")).toBe("25");
	expect(inserted.getAttribute("height")).toBe("35");
  });

  test("still dispatches SVGready when no target element exists", async () => {
	const {
	  form
	} = createFixture({
	  includeTarget: false
	});

	const listener = vi.fn();

	form.addEventListener("SVGready", listener);

	vi.stubGlobal(
	  "fetch",
	  vi
		.fn()
		.mockResolvedValueOnce(
		  jsonResponse({
			files: [
			  {
				status: "success",
				original_name: "photo.png",
				filename: "saved-photo.png",
				url: "/uploads/saved-photo.png",
				measure_url: "/measure/saved-photo.png"
			  }
			]
		  })
		)
		.mockResolvedValueOnce(
		  jsonResponse({
			svg: [
			  `
				<svg xmlns="http://www.w3.org/2000/svg">
				  <path id="no-target-path" />
				</svg>
			  `
			]
		  })
		)
	);

	submit(form);

	await waitFor(() => {
	  expect(listener).toHaveBeenCalledOnce();
	});

	expect(
	  listener.mock.calls[0][0].detail.id
	).toBe("no-target-path");
  });

  test("shows a measurement error returned by the server", async () => {
	const {
	  form,
	  status,
	  submitButton
	} = createFixture();

	vi.stubGlobal(
	  "fetch",
	  vi
		.fn()
		.mockResolvedValueOnce(
		  jsonResponse({
			files: [
			  {
				status: "success",
				original_name: "photo.png",
				filename: "saved-photo.png",
				url: "/uploads/saved-photo.png",
				measure_url: "/measure/saved-photo.png"
			  }
			]
		  })
		)
		.mockResolvedValueOnce(
		  jsonResponse(
			{
			  error: "No contour could be detected."
			},
			{
			  status: 422
			}
		  )
		)
	);

	submit(form);

	await waitFor(() => {
	  expect(status.textContent).toContain(
		"Measurement error: No contour could be detected."
	  );
	});

	expect(submitButton.disabled).toBe(false);
  });

  test("re-enables the upload button after successful processing", async () => {
	const {
	  form,
	  submitButton
	} = createFixture();

	let resolveUpload;

	const uploadPromise = new Promise(resolve => {
	  resolveUpload = resolve;
	});

	const fetchMock = vi
	  .fn()
	  .mockReturnValueOnce(uploadPromise)
	  .mockResolvedValueOnce(
		jsonResponse({
		  svg: [
			`
			  <svg xmlns="http://www.w3.org/2000/svg">
				<path />
			  </svg>
			`
		  ]
		})
	  );

	vi.stubGlobal("fetch", fetchMock);

	submit(form);

	await waitFor(() => {
	  expect(submitButton.disabled).toBe(true);
	});

	resolveUpload(
	  jsonResponse({
		files: [
		  {
			status: "success",
			original_name: "photo.png",
			filename: "saved-photo.png",
			url: "/uploads/saved-photo.png",
			measure_url: "/measure/saved-photo.png"
		  }
		]
	  })
	);

	await waitFor(() => {
	  expect(submitButton.disabled).toBe(false);
	});
  });
});