import type * as T from '../../types/v4/contracts.js';
export declare const contractVersion: "session-operation-authorization/v1";
export declare const operations: ReadonlyArray<import('../../types/v4/index.js').OperationContract>;
export declare function validate(operation: "ReadOriginalSessionAuthority", value: unknown): T.ReadOriginalSessionAuthorityRequest;
export declare function admit(operation: "ReadOriginalSessionAuthority", bytes: Uint8Array): T.ReadOriginalSessionAuthorityRequest;
export declare function response(operation: "ReadOriginalSessionAuthority", value: unknown): T.ReadOriginalSessionAuthorityResponse;
