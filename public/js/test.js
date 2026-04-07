// 1. Initialize Postmonger session at the top
var connection = new Postmonger.Session();
var payload = {};
var schema = [];

// 2. Add the window.ready logic to break the loading spinner
$(window).ready(function() {
    connection.trigger('ready'); // CRITICAL: This stops the loading spinner
    connection.trigger('requestSchema'); // Request schema on initialization
});

// 3. Your existing initActivity logic
connection.on('initActivity', function(data) {
    if (data) { 
        payload = data; 
    }
    // Hydrate existing values if activity was already configured
    hydrateFromExistingPayload();
});

// 4. Handle requestedSchema to get field names
connection.on('requestedSchema', function (data) {
    // Validate that schema data exists
    if (!data || !data.schema) {
        console.warn('No schema data received');
        return;
    }
    
    schema = data.schema;
    
    // Populate field checkboxes
    var $fieldSelection = $('#fieldSelection');
    $fieldSelection.empty();
    
    schema.forEach(function(field) {
        if (!field || !field.key) {
            return;
        }
        
        var fieldName = field.name || field.key;
        var checkbox = $('<div style="margin-bottom: 8px;">' +
            '<label style="cursor: pointer;">' +
            '<input type="checkbox" class="field-checkbox" value="' + field.key + '" style="margin-right: 8px;">' +
            fieldName +
            '</label>' +
            '</div>');
        
        $fieldSelection.append(checkbox);
    });
    
    // Hydrate after populating fields
    hydrateFromExistingPayload();
});

function save() {
    var endpointUrl = ($('#endpointUrl').val() || '').trim();
    
    // Get all selected fields
    var selectedFields = {};
    $('.field-checkbox:checked').each(function() {
        var fieldKey = $(this).val(); // e.g., "Event.DEKey.email"
        
        // Extract the actual field name from the schema key
        // If fieldKey is "Event.DEKey.email", extract "email"
        var parts = fieldKey.split('.');
        var actualFieldName = parts[parts.length - 1];
        
        // Store as actualFieldName: "{{Event.DEKey.FieldName}}"
        selectedFields[actualFieldName] = '{{' + fieldKey + '}}';
    });

    // Initialize payload structure if not exists
    payload.arguments = payload.arguments || {};
    payload.arguments.execute = payload.arguments.execute || {};
    payload.metaData = payload.metaData || {};

    // Journey context fields (journeyId, activityId, etc.) are NOT valid
    // data binding expressions in inArguments. SFMC sends them automatically
    // in the top-level execute request body. We only store which ones the
    // user selected so the server knows what to include in the endpoint payload.
    var selectedJourneyKeys = [];
    $('.journey-checkbox:checked').each(function() {
        selectedJourneyKeys.push($(this).val());
    });

    // Build flat inArguments — only DE field bindings are valid handlebars here.
    var inArgs = {
        endpointUrl: endpointUrl || null
    };

    // Flatten field mappings directly into inArgs (these are valid DE bindings)
    Object.keys(selectedFields).forEach(function(key) {
        inArgs[key] = selectedFields[key];
    });

    // Store metadata as plain comma-separated strings (scalars, not objects)
    inArgs._fieldMappingKeys = Object.keys(selectedFields).join(',');
    inArgs._journeyContextKeys = selectedJourneyKeys.join(',');

    payload.arguments.execute.inArguments = [inArgs];
    
    payload.metaData.isConfigured = true;
    connection.trigger('updateActivity', payload);
}

function hydrateFromExistingPayload() {
    var existing = payload && payload.arguments && payload.arguments.execute && payload.arguments.execute.inArguments;
    if (!existing || existing.length === 0) {
        return;
    }

    var args = existing[0] || {};
    
    // Restore endpoint URL
    if (args.endpointUrl) {
        $('#endpointUrl').val(args.endpointUrl);
    }

    // Restore selected fields (flat keys now)
    var fieldMappingKeys = (args._fieldMappingKeys || '').split(',').filter(Boolean);
    if (fieldMappingKeys.length > 0) {
        $('.field-checkbox').each(function() {
            var fieldKey = $(this).val();
            var parts = fieldKey.split('.');
            var fieldName = parts[parts.length - 1];
            
            if (fieldMappingKeys.indexOf(fieldName) !== -1) {
                $(this).prop('checked', true);
            }
        });
    }

    // Restore selected journey context fields (flat keys now)
    var journeyContextKeys = (args._journeyContextKeys || '').split(',').filter(Boolean);
    if (journeyContextKeys.length > 0) {
        $('.journey-checkbox').each(function() {
            var key = $(this).val();
            if (journeyContextKeys.indexOf(key) !== -1) {
                $(this).prop('checked', true);
            }
        });
    }
}

// 5. Connect the Salesforce 'Next' button to your save function
connection.on('clickedNext', save);

// 6. Test Connection button handler
$('#testConnection').on('click', function() {
    var endpointUrl = ($('#endpointUrl').val() || '').trim();
    var $btn = $(this);
    var $result = $('#testResult');

    if (!endpointUrl) {
        $result.css({ display: 'block', backgroundColor: '#fef0e1', color: '#8c4b0a', border: '1px solid #f0ad4e' })
               .text('Please enter an endpoint URL first.');
        return;
    }

    // Gather selected field names to send as test payload
    var testFields = [];
    $('.field-checkbox:checked').each(function() {
        var fieldKey = $(this).val();
        var parts = fieldKey.split('.');
        testFields.push(parts[parts.length - 1]);
    });

    $btn.prop('disabled', true).text('Testing...');
    $result.css({ display: 'block', backgroundColor: '#e8f4fd', color: '#032d60', border: '1px solid #1589ee' })
           .text('Sending test request...');

    $.ajax({
        url: '/test-endpoint',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ endpointUrl: endpointUrl, fields: testFields }),
        success: function(data) {
            if (data.success) {
                $result.css({ backgroundColor: '#d4edda', color: '#155724', border: '1px solid #28a745' })
                       .html('<strong>Status ' + data.status + '</strong><br>Response: ' + $('<span>').text(JSON.stringify(data.response)).html());
            } else {
                $result.css({ backgroundColor: '#f8d7da', color: '#721c24', border: '1px solid #dc3545' })
                       .text('Error: ' + (data.error || 'Unknown error'));
            }
        },
        error: function(xhr) {
            $result.css({ backgroundColor: '#f8d7da', color: '#721c24', border: '1px solid #dc3545' })
                   .text('Request failed: ' + xhr.statusText);
        },
        complete: function() {
            $btn.prop('disabled', false).text('Test Connection');
        }
    });
});
