

let currentShortId = ''; // Global variable to store the current shortId being edited

function openEditPopup(shortId) {
    currentShortId = shortId;
    fetch(`http://localhost:3000/s/${shortId}`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('editUrlInput').value = data.url;
            document.getElementById('editPopup').style.display = 'block';
        })
        .catch(error => {
            console.error('Error fetching URL:', error.message);
            alert('Failed to fetch URL for editing.');
        });
}

function closeEditPopup() {
    document.getElementById('editPopup').style.display = 'none';
}

function updateUrl() {
    const url = document.getElementById('editUrlInput').value;

    fetch(`http://localhost:3000/s/${currentShortId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
    })
    .then(response => response.json())
    .then(data => {
        console.log('Updated URL:', data);
        closeEditPopup();
        // Optionally update UI after successful update
        // For example, reload URLs list or update specific element
    })
    .catch(error => {
        console.error('Error updating URL:', error.message);
        alert('Failed to update URL.');
    });
}

function deleteUrl(shortId) {
    fetch(`http://localhost:3000/s/${shortId}`, {
        method: 'DELETE'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to delete URL');
        }
        // Optionally update UI after successful delete
        // For example, remove deleted URL from list or table
    })
    .catch(error => {
        console.error('Error deleting URL:', error.message);
        alert('Failed to delete URL.');
    });
}
