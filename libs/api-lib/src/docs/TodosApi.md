# TodosApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**todosControllerCreate**](#todoscontrollercreate) | **POST** /api/todos | |
|[**todosControllerFindAll**](#todoscontrollerfindall) | **GET** /api/todos | |
|[**todosControllerFindOne**](#todoscontrollerfindone) | **GET** /api/todos/{id} | |
|[**todosControllerRemove**](#todoscontrollerremove) | **DELETE** /api/todos/{id} | |
|[**todosControllerUpdate**](#todoscontrollerupdate) | **PATCH** /api/todos/{id} | |

# **todosControllerCreate**
> todosControllerCreate(createTodoDto)


### Example

```typescript
import {
    TodosApi,
    Configuration,
    CreateTodoDto
} from './api';

const configuration = new Configuration();
const apiInstance = new TodosApi(configuration);

let createTodoDto: CreateTodoDto; //

const { status, data } = await apiInstance.todosControllerCreate(
    createTodoDto
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **createTodoDto** | **CreateTodoDto**|  | |


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**201** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **todosControllerFindAll**
> todosControllerFindAll()


### Example

```typescript
import {
    TodosApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new TodosApi(configuration);

const { status, data } = await apiInstance.todosControllerFindAll();
```

### Parameters
This endpoint does not have any parameters.


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **todosControllerFindOne**
> todosControllerFindOne()


### Example

```typescript
import {
    TodosApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new TodosApi(configuration);

let id: string; // (default to undefined)

const { status, data } = await apiInstance.todosControllerFindOne(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **todosControllerRemove**
> todosControllerRemove()


### Example

```typescript
import {
    TodosApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new TodosApi(configuration);

let id: string; // (default to undefined)

const { status, data } = await apiInstance.todosControllerRemove(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **todosControllerUpdate**
> todosControllerUpdate(updateTodoDto)


### Example

```typescript
import {
    TodosApi,
    Configuration,
    UpdateTodoDto
} from './api';

const configuration = new Configuration();
const apiInstance = new TodosApi(configuration);

let id: string; // (default to undefined)
let updateTodoDto: UpdateTodoDto; //

const { status, data } = await apiInstance.todosControllerUpdate(
    id,
    updateTodoDto
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **updateTodoDto** | **UpdateTodoDto**|  | |
| **id** | [**string**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

