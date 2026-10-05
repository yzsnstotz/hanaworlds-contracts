import type * as T from '../../types/v4/contracts.js';
export declare const contractVersion: "session-authorization/v1";
export declare const operations: ReadonlyArray<import('../../types/v4/index.js').OperationContract>;
export declare function validate(operation: "ReadOriginalBinding", value: unknown): T.ReadOriginalBindingRequest;
export declare function admit(operation: "ReadOriginalBinding", bytes: Uint8Array): T.ReadOriginalBindingRequest;
export declare function response(operation: "ReadOriginalBinding", value: unknown): T.ReadOriginalBindingResponse;
export declare function validate(operation: "VerifyCurrentGrant", value: unknown): T.VerifyCurrentGrantRequest;
export declare function admit(operation: "VerifyCurrentGrant", bytes: Uint8Array): T.VerifyCurrentGrantRequest;
export declare function response(operation: "VerifyCurrentGrant", value: unknown): T.VerifyCurrentGrantResponse;
