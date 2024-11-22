import {Runtime} from 'aws-cdk-lib/aws-lambda';
import {NodejsFunction} from 'aws-cdk-lib/aws-lambda-nodejs';
import {AttributeType, BillingMode, Table, TableEncryption} from 'aws-cdk-lib/aws-dynamodb';
import {
    RestApi,
    LambdaIntegration,
    AuthorizationType,
    ApiKey,
    UsagePlan,
    Period
} from 'aws-cdk-lib/aws-apigateway';
import {join} from 'path';
import {Construct} from 'constructs';
import {Key} from 'aws-cdk-lib/aws-kms';
import {Duration, RemovalPolicy, Stack, StackProps} from 'aws-cdk-lib';

export class SimpleWebServerStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const encryptionKey = new Key(this, 'Key', {
            enableKeyRotation: true,
        });

        // Create DynamoDB table
        const table = new Table(this, 'ItemsTable', {
            tableName: 'items',
            partitionKey: {name: 'id', type: AttributeType.STRING},
            billingMode: BillingMode.PAY_PER_REQUEST,
            removalPolicy: RemovalPolicy.DESTROY,
            pointInTimeRecovery: true,
            encryption: TableEncryption.CUSTOMER_MANAGED,
            encryptionKey,
        });

        // Create Lambda function for reading items
        const readItemFunction = new NodejsFunction(this, 'ReadItemFunction', {
            runtime: Runtime.NODEJS_18_X,
            handler: 'handler',
            timeout: Duration.seconds(5),
            entry: join(__dirname, 'lambda/read-item.ts'),
            environment: {
                TABLE_NAME: table.tableName,
            },
        });

        // Create Lambda function for writing items
        const writeItemFunction = new NodejsFunction(this, 'WriteItemFunction', {
            runtime: Runtime.NODEJS_18_X,
            handler: 'handler',
            timeout: Duration.seconds(5),
            entry: join(__dirname, 'lambda/write-item.ts'),
            environment: {
                TABLE_NAME: table.tableName,
            },
        });

        // Grant specific DynamoDB permissions based on least privilege
        table.grant(readItemFunction, 'dynamodb:GetItem');
        table.grant(writeItemFunction, 'dynamodb:PutItem');

        // Grant KMS permissions for both functions
        encryptionKey.grantDecrypt(readItemFunction);
        encryptionKey.grantEncrypt(writeItemFunction);

        // Create API Gateway
        const api = new RestApi(this, 'ItemsApi', {
            restApiName: 'Items Service',
            description: 'This is a simple API Gateway with Lambda integration',
            defaultMethodOptions: {
                authorizationType: AuthorizationType.IAM
            }
        });


        const apiKey = new ApiKey(this, 'ApiKey', {
            enabled: true,
            description: 'API Key for the Items Service'
        });

        const usagePlan = new UsagePlan(this, 'UsagePlan', {
            name: 'Usage Plan',
            description: 'Standard usage plan for Items API',
            apiStages: [
                {
                    api: api,
                    stage: api.deploymentStage
                }
            ],
            throttle: {
                rateLimit: 10,    // requests per second
                burstLimit: 20    // maximum requests in burst
            },
            quota: {
                limit: 1000,      // number of requests
                period: Period.MONTH
            }
        });

        usagePlan.addApiKey(apiKey);

        const methodOptions = {
            apiKeyRequired: true,
            authorizationType: AuthorizationType.IAM
        };


        // Create API Gateway resources and methods
        const items = api.root.addResource('items');
        const item = items.addResource('{id}');

        const readIntegration = new LambdaIntegration(readItemFunction);
        const writeIntegration = new LambdaIntegration(writeItemFunction);

        item.addMethod('GET', readIntegration, methodOptions);  // GET /items/{id}
        items.addMethod('POST', writeIntegration, methodOptions);  // POST /items
    }
}
